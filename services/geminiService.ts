import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { InitialIdea, Page, Book, Revision, CaptureData, GeneratedBook } from '../types';
import { compressImageBase64 } from "../utils/imageUtils";
import { saveVideo } from "../utils/videoDb";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const textModel = 'gemini-2.5-flash';
const visionModel = 'gemini-2.5-flash-image-preview';

const getAgeAppropriateInstructions = (age: number): string => {
  if (age <= 5) {
    return `
      - Vocabulary and sentences must be extremely simple. Use basic words, repetitive phrases, and short sentences (5-7 words) with a clear subject-verb-object structure. Example: "The bear is happy. He eats honey."
      - Narrative should be linear and predictable.
      - Illustrator prompts should describe simple scenes with one or two characters, clear emotions, and uncluttered backgrounds.
    `;
  }
  if (age <= 7) {
    return `
      - Use slightly more descriptive language and compound sentences (around 10-15 words). Pages can have 2-3 sentences.
      - Introduce simple dialogue and basic cause-and-effect.
      - Narrative can have simple, positive events or challenges.
      - Illustrator prompts can include more background details and simple character interactions.
    `;
  }
  // Ages 8-9
  return `
      - Use more complex sentences with conjunctions (like 'and', 'but', 'because').
      - Use creative descriptors, simple metaphors, and a more developed vocabulary.
      - Narrative can include small surprises, simple plot points, and character thoughts or feelings.
      - Illustrator prompts can describe more dynamic scenes with multiple elements, side characters, and more detailed environments.
    `;
};

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

async function processAndCompressImage(rawBase64: string): Promise<string> {
    const fullBase64Url = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
    try {
        return await compressImageBase64(fullBase64Url);
    } catch (error) {
        console.error("Image compression failed, using original image.", error);
        return fullBase64Url;
    }
}

async function generateImage(prompt: string, style: string, referenceImage?: { base64: string, mimeType: string }): Promise<string> {
    const fullPrompt = `The required visual style is strictly: "${style}". This is the most important instruction. Generate a child-friendly and vibrant illustration for the following scene: ${prompt}`;

    const parts: any[] = [{ text: fullPrompt }];

    if (referenceImage) {
        parts.unshift({
            inlineData: {
                data: referenceImage.base64,
                mimeType: referenceImage.mimeType
            }
        });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: visionModel,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("AI did not return an image.");
}

async function interpretCapture(capture: CaptureData, age: number, contextPrompt: string): Promise<{ title?: string; subtitle?: string; characters?: string; pageText: string; imagePrompt: string; }> {
    const ageInstructions = getAgeAppropriateInstructions(age);
    const userTextPrompt = capture.text ? `The user's primary instruction is this text: "${capture.text}". This text should be the main guide for the story.` : "The user did not provide a text prompt, so interpret the media directly.";
    let interpretationPrompt: string;
    const modelParts: any[] = [];

    switch (capture.type) {
        case 'drawing':
            interpretationPrompt = `
              ${userTextPrompt}
              The user also provided this drawing as visual inspiration.
              Your task is to write a story page for a ${age}-year-old that combines the user's text with the visual elements from the drawing.
              Also create a detailed illustrator prompt that merges the text idea with the drawing's content.
              ${contextPrompt}`;
            modelParts.push({ text: interpretationPrompt }, { inlineData: { mimeType: capture.mimeType, data: capture.base64 } });
            break;
        case 'video':
            interpretationPrompt = `
              ${userTextPrompt}
              The user also acted out the story in a video, from which this is a keyframe.
              During the video, the user said: "${capture.transcript || 'No speech detected.'}".
              Combine the user's text, the visual action, and their speech to write a story page for a ${age}-year-old.
              Create a detailed illustrator prompt based on the fusion of these ideas.
              ${contextPrompt}`;
             modelParts.push({ text: interpretationPrompt }, { inlineData: { mimeType: capture.mimeType, data: capture.base64 } });
            break;
    }

    const response = await ai.models.generateContent({
        model: textModel,
        contents: { parts: modelParts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    characters: { type: Type.STRING },
                    pageText: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text);
}


export async function generateStylePreviewImage(idea: InitialIdea, style: string): Promise<string> {
    const prompt = `A sample image for a story about: "${idea.text || 'a friendly character on an adventure'}" The illustration must NOT contain any text, letters, or words.`;
    
    const referenceImageItem = idea.media.find(m => m.type === 'image');
    const referenceImage = referenceImageItem 
        ? { base64: referenceImageItem.base64, mimeType: referenceImageItem.mimeType }
        : undefined;
    
    const imageBase64 = await generateImage(prompt, style, referenceImage);
    return processAndCompressImage(imageBase64);
}


export async function generateCoverAndFirstPage(idea: InitialIdea, age: number, style: string, onProgress: (message: string) => void): Promise<{ title: string; subtitle: string; characters: string; coverImageUrl: string; firstPage: Page }> {
    onProgress('Step 1/3: Writing the beginning...');
    const ageInstructions = getAgeAppropriateInstructions(age);
    const ideaPrompt = idea.text || "a story about a brave little bear";
    const prompt = `
      You are an expert children's book author. Your task is to generate content for a storybook for a ${age}-year-old child.
      Follow these age-specific guidelines strictly:
      ${ageInstructions}

      The user's story idea is: "${ideaPrompt}". The user has also provided one or more media files (images, videos) as inspiration. Use them to inform the story and characters.

      Based on the idea and the age guidelines, generate:
      1. A short, simple, and magical story title.
      2. A 1-line subtitle.
      3. A brief description of the main characters.
      4. The text for the very first page.
    `;

    const modelParts: any[] = [{ text: prompt }];
    idea.media.forEach(item => {
        modelParts.push({
            inlineData: {
                mimeType: item.mimeType,
                data: item.base64
            }
        });
    });

    const response = await ai.models.generateContent({
        model: textModel,
        contents: { parts: modelParts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    characters: { type: Type.STRING },
                    firstPageText: { type: Type.STRING }
                }
            }
        }
    });

    const { title, subtitle, characters, firstPageText } = JSON.parse(response.text);

    onProgress('Step 2/3: Designing the cover...');
    const referenceImageItem = idea.media.find(m => m.type === 'image');
    const initialReference = referenceImageItem
        ? { base64: referenceImageItem.base64, mimeType: referenceImageItem.mimeType }
        : undefined;

    const storyIdea = idea.text ? ` The story is about: "${idea.text}".` : '';
    const coverImagePrompt = `A beautiful illustration for the cover of a children's book. The book title is "${title}". This title text MUST be written clearly and creatively on the image. The scene should visually represent the story's theme and feature the main characters: ${characters}.${storyIdea} The visual style should be appropriate for a ${age}-year-old.`;
    
    onProgress('Step 3/3: Illustrating the first page...');
    const firstPageImagePrompt = `An illustration for the very first page of a story, which must be different from the cover. The scene is: "${firstPageText}". The characters are: ${characters}. Maintain the same art style and character design as the provided reference image. The visual complexity must be appropriate for a ${age}-year-old. IMPORTANT: Do NOT include any text, letters, or words in this image.`;
    
    const [coverImageBase64, firstPageImageBase64] = await Promise.all([
        generateImage(coverImagePrompt, style, initialReference),
        generateImage(firstPageImagePrompt, style, { base64: await generateImage(coverImagePrompt, style, initialReference), mimeType: 'image/png' }), // Use a fresh cover generation to pass as reference
    ]);
    
    return {
        title,
        subtitle,
        characters,
        coverImageUrl: await processAndCompressImage(coverImageBase64),
        firstPage: {
            id: generateId(),
            revisions: [{
                text: firstPageText,
                imageUrl: await processAndCompressImage(firstPageImageBase64),
                type: 'initial',
            }],
            currentRevisionIndex: 0
        }
    };
}

export async function generateFullBook(idea: InitialIdea, age: number, style: string, onProgress: (message: string) => void): Promise<GeneratedBook> {
    onProgress('Step 1/3: Writing your complete story...');
    const ageInstructions = getAgeAppropriateInstructions(age);
    const ideaPrompt = idea.text || "a story about a brave little bear";
    const prompt = `
        You are an expert children's book author creating a complete 6-12 page illustrated storybook for a ${age}-year-old child.
        Follow these age-specific guidelines strictly for ALL parts of the book (text and image prompts):
        ${ageInstructions}

        The user's story idea is: "${ideaPrompt}". The user has also provided one or more media files (images, videos) as inspiration. Use them to inform the story, characters, and scenes.

        Based on the idea and the age guidelines, provide:
        1. The book title.
        2. A 1-line subtitle.
        3. A brief description of the main characters.
        4. For each of the pages, provide:
            - "pageText": The text for the page.
            - "imagePrompt": A detailed prompt for an illustrator that matches the text and follows the age-specific visual guidelines. The prompts should describe the scene and characters clearly to maintain consistency. These prompts MUST NOT contain instructions to write text.
    `;

    const modelParts: any[] = [{ text: prompt }];
    idea.media.forEach(item => {
        modelParts.push({
            inlineData: {
                mimeType: item.mimeType,
                data: item.base64
            }
        });
    });
    
    const response = await ai.models.generateContent({
        model: textModel,
        contents: { parts: modelParts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    characters: { type: Type.STRING },
                    pages: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                pageText: { type: Type.STRING },
                                imagePrompt: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    });

    const bookData = JSON.parse(response.text);

    if (!bookData.pages || !Array.isArray(bookData.pages)) {
        console.error("AI response for full book is missing or has malformed pages data.", bookData);
        throw new Error("The AI failed to create a valid story structure. Please try again with a different prompt.");
    }

    onProgress('Step 2/3: Designing the beautiful cover...');
    const referenceImageItem = idea.media.find(m => m.type === 'image');
    const initialReference = referenceImageItem
        ? { base64: referenceImageItem.base64, mimeType: referenceImageItem.mimeType }
        : undefined;

    const coverImagePrompt = `A beautiful illustration for the cover of a children's book. The book title is "${bookData.title}". This title MUST be written clearly and creatively on the image. The scene should feature the characters: ${bookData.characters}. The visual complexity must be appropriate for a ${age}-year-old.`;
    const coverImageBase64 = await generateImage(coverImagePrompt, style, initialReference);

    const pagesWithImages: Page[] = [];
    let previousImage = { base64: coverImageBase64, mimeType: 'image/png' };

    onProgress(`Step 3/3: Illustrating ${bookData.pages.length} pages...`);
    for (const pageContent of bookData.pages) {
        const consistencyPrompt = " Maintain the same art style and character design as the provided reference image. IMPORTANT: Do not add any text, letters, or words to the image.";
        
        const imageBase64 = await generateImage(
            `${pageContent.imagePrompt} The characters are: ${bookData.characters}.${consistencyPrompt}`,
            style,
            previousImage
        );
        
        previousImage = { base64: imageBase64, mimeType: 'image/png' }; // Update for next loop

        pagesWithImages.push({
            id: generateId(),
            revisions: [{
                text: pageContent.pageText,
                imageUrl: await processAndCompressImage(imageBase64),
                type: 'initial',
            }],
            currentRevisionIndex: 0,
        });
    }

    return {
        id: new Date().toISOString(),
        creationDate: new Date().toLocaleDateString(),
        title: bookData.title,
        subtitle: bookData.subtitle,
        characters: bookData.characters,
        coverImageUrl: await processAndCompressImage(coverImageBase64),
        pages: pagesWithImages,
        age,
        style,
    };
}


export async function generateNextPage(book: Book, nextIdea: InitialIdea, age: number, style: string): Promise<Page> {
    if (nextIdea.capture) {
        return generateNextPageFromCapture(book, nextIdea.capture, age, style);
    }
    
    const ageInstructions = getAgeAppropriateInstructions(age);
    const storySoFar = book.pages.map(p => p.revisions[p.currentRevisionIndex].text).join('\n');
    const ideaPrompt = nextIdea.text 
        ? `The user wants this to happen next: "${nextIdea.text}".`
        : "Continue the story creatively.";
    
    const prompt = `
        You are an expert children's book author continuing a story for a ${age}-year-old child.
        Follow these age-specific guidelines strictly:
        ${ageInstructions}

        Here is the story so far:
        "${storySoFar}"

        The main characters are: ${book.characters}.
        ${ideaPrompt}

        Based on this, continue the story with the very next scene. Provide:
        - "nextPageText": The text for this new page.
        - "imagePrompt": A detailed prompt for an illustrator that follows the age-specific visual guidelines. This prompt must not instruct the illustrator to add text.
    `;

    const modelParts: any[] = [{ text: prompt }];
    if (nextIdea.media && nextIdea.media[0] && nextIdea.media[0].type === 'image') {
       modelParts.push({ inlineData: { mimeType: nextIdea.media[0].mimeType, data: nextIdea.media[0].base64 } });
    }

    const response = await ai.models.generateContent({
        model: textModel,
        contents: { parts: modelParts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    nextPageText: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                }
            }
        }
    });
    
    const { nextPageText, imagePrompt } = JSON.parse(response.text);

    const lastPage = book.pages[book.pages.length - 1];
    const lastRevision = lastPage.revisions[lastPage.currentRevisionIndex];
    const [header, base64] = lastRevision.imageUrl.split(',');
    if (!header || !base64) throw new Error("Could not parse previous page image for reference.");
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    const consistencyPrompt = " Maintain the same art style and character design as the provided reference image. IMPORTANT: Do not add any text, letters, or words to the image.";
    
    const imageBase64 = await generateImage(
        `${imagePrompt} The characters are: ${book.characters}.${consistencyPrompt}`,
        style,
        referenceImage
    );

    return {
        id: generateId(),
        revisions: [{
            text: nextPageText,
            imageUrl: await processAndCompressImage(imageBase64),
            type: 'initial',
        }],
        currentRevisionIndex: 0,
    };
}

async function generateNextPageFromCapture(book: Book, capture: CaptureData, age: number, style: string): Promise<Page> {
    const storySoFar = book.pages.map(p => p.revisions[p.currentRevisionIndex].text).join('\n');
    const context = `The story so far is: "${storySoFar}". The main characters are: ${book.characters}. Continue the story based on the new input.`;
    
    const interpretation = await interpretCapture(capture, age, context);
    const { pageText, imagePrompt } = interpretation;

    const lastPage = book.pages[book.pages.length - 1];
    const lastRevision = lastPage.revisions[lastPage.currentRevisionIndex];
    const [header, base64] = lastRevision.imageUrl.split(',');
    if (!header || !base64) throw new Error("Could not parse previous page image for reference.");
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    const styleInstruction = capture.type === 'drawing' && capture.mimicStyle 
        ? "Mimic the simple, charming style of the provided child's drawing."
        : style;
    
    const imageBase64 = await generateImage(
        `${imagePrompt} The characters are: ${book.characters}. IMPORTANT: Do not add any text, letters, or words to the image.`,
        styleInstruction,
        referenceImage
    );

    return {
        id: generateId(),
        revisions: [{
            text: pageText,
            imageUrl: await processAndCompressImage(imageBase64),
            type: 'initial',
            capture,
        }],
        currentRevisionIndex: 0,
    };
}

export async function generateStoryEnding(book: Book, age: number, style: string): Promise<Page> {
    const ageInstructions = getAgeAppropriateInstructions(age);
    const storySoFar = book.pages.map(p => p.revisions[p.currentRevisionIndex].text).join('\n');
    
    const prompt = `
        You are an expert children's book author writing the final page of a story for a ${age}-year-old child.
        Follow these age-specific guidelines strictly:
        ${ageInstructions}

        Here is the story so far:
        "${storySoFar}"

        The main characters are: ${book.characters}.

        Now, write a short and happy final paragraph to conclude the story. Provide:
        - "finalPageText": The text for this final page.
        - "imagePrompt": A detailed prompt for an illustrator for the concluding scene, following the age-specific visual guidelines. This prompt must not instruct the illustrator to add text.
    `;

    const response = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    finalPageText: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                }
            }
        }
    });
    
    const { finalPageText, imagePrompt } = JSON.parse(response.text);

    const lastPage = book.pages[book.pages.length - 1];
    const lastRevision = lastPage.revisions[lastPage.currentRevisionIndex];
    const [header, base64] = lastRevision.imageUrl.split(',');
    if (!header || !base64) throw new Error("Could not parse previous page image for reference.");
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    const consistencyPrompt = " Maintain the same art style and character design as the provided reference image. IMPORTANT: Do not add any text, letters, or words to the image.";
    
    const imageBase64 = await generateImage(
        `${imagePrompt} The characters are: ${book.characters}.${consistencyPrompt}`,
        style,
        referenceImage
    );

    return {
        id: generateId(),
        revisions: [{
            text: finalPageText,
            imageUrl: await processAndCompressImage(imageBase64),
            type: 'initial',
        }],
        currentRevisionIndex: 0,
    };
}

export async function revisePage(page: Page, revisionPromptOrCapture: string | CaptureData, age: number, style: string, revisionType: 'text' | 'image', characters?: string): Promise<{ newRevision: Revision }> {
    if (typeof revisionPromptOrCapture !== 'string') {
        return revisePageFromCapture(page, revisionPromptOrCapture, age, style, characters);
    }
    
    const ageInstructions = getAgeAppropriateInstructions(age);
    const currentRevision = page.revisions[page.currentRevisionIndex];
    const characterInfo = characters ? ` Remember the main characters are: ${characters}.` : '';

    const previousImageUrl = currentRevision.imageUrl;
    const [header, base64] = previousImageUrl.split(',');
    if (!header || !base64) {
        throw new Error("Invalid image URL format for revision.");
    }
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    let newText = currentRevision.text;
    let newImageUrl: string;

    if (revisionType === 'text') {
        const prompt = `
            You are an expert children's book author rewriting a story paragraph for a ${age}-year-old child.
            Follow these age-specific guidelines strictly:
            ${ageInstructions}

            Original Text: "${currentRevision.text}"
            User's Instruction: "${revisionPromptOrCapture}"
            
            Your response must ONLY be the rewritten story text, adhering to the age guidelines.
        `;
        
        const response = await ai.models.generateContent({ model: textModel, contents: prompt });
        newText = response.text.trim();
        
        const imagePrompt = `An illustration for the scene: "${newText}".${characterInfo} Maintain the style of the provided image. IMPORTANT: Do not add any text, letters, or words to the image.`;
        
        const imageBase64 = await generateImage(imagePrompt, style, referenceImage);
        newImageUrl = await processAndCompressImage(imageBase64);
        return { newRevision: { text: newText, imageUrl: newImageUrl, type: revisionType } };

    } else { // 'image'
        const imagePrompt = `${revisionPromptOrCapture}.${characterInfo} IMPORTANT: Do not add any text, letters, or words to the image.`;
        const imageBase64 = await generateImage(imagePrompt, style, referenceImage);
        newImageUrl = await processAndCompressImage(imageBase64);
        return { newRevision: { text: newText, imageUrl: newImageUrl, type: revisionType } };
    }
}

export async function reviseCoverImage(book: Book, revisionPrompt: string): Promise<{ newCoverImageUrl: string }> {
    const ageInstructions = getAgeAppropriateInstructions(book.age);
    
    const [header, base64] = book.coverImageUrl.split(',');
    if (!header || !base64) {
        throw new Error("Invalid cover image URL format for revision.");
    }
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    const imagePrompt = `The user wants to revise the book cover. Their instruction is: "${revisionPrompt}". The book is titled "${book.title}" and the author is "${book.author}". The title and author MUST be written on the image. The characters are: ${book.characters}. The visual complexity must be appropriate for a ${book.age}-year-old. Follow these guidelines: ${ageInstructions}. Maintain the same art style and character design as the provided reference image.`;
    const imageBase64 = await generateImage(imagePrompt, book.style, referenceImage);

    const newCoverImageUrl = await processAndCompressImage(imageBase64);
    
    return { newCoverImageUrl };
}

async function revisePageFromCapture(page: Page, capture: CaptureData, age: number, style: string, characters?: string): Promise<{ newRevision: Revision }> {
    const currentRevision = page.revisions[page.currentRevisionIndex];
    const context = `The current page text is: "${currentRevision.text}". The user wants to revise it based on their new input. The main characters are: ${characters}.`;
    
    const interpretation = await interpretCapture(capture, age, context);
    const { pageText, imagePrompt } = interpretation;

    const [header, base64] = currentRevision.imageUrl.split(',');
    if (!header || !base64) throw new Error("Could not parse previous page image for reference.");
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    const styleInstruction = capture.type === 'drawing' && capture.mimicStyle 
        ? "Mimic the simple, charming style of the provided child's drawing."
        : style;
    
    const imageBase64 = await generateImage(
        `${imagePrompt} The characters are: ${characters}. IMPORTANT: Do not add any text, letters, or words to the image.`,
        styleInstruction,
        referenceImage
    );
    
    const newRevision: Revision = {
        text: pageText,
        imageUrl: await processAndCompressImage(imageBase64),
        type: 'text', // Capture revisions can change both text and image
        capture,
    };
    
    return { newRevision };
}

export async function generateSinglePageVideo(
    book: Book,
    page: Page,
    onProgress: (message: string, percentage: number) => void
): Promise<{ videoUrl: string }> {
    const pageText = page.revisions[page.currentRevisionIndex].text;

    const videoPrompt = `
        An animated video scene in the style of "${book.style}".
        The animation should be magical, vibrant, and beautiful, suitable for a child aged ${book.age}.
        The scene should match the provided reference image and be animated based on the text: "${pageText}".
    `;

    const [header, base64] = page.revisions[page.currentRevisionIndex].imageUrl.split(',');
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    if (!referenceImage.base64 || !referenceImage.mimeType) {
        throw new Error(`Reference image for page video is invalid.`);
    }

    onProgress('Sending request to the video model...', 5);
    let operation = await ai.models.generateVideos({
        model: 'veo-3.0-fast-generate-preview',
        prompt: videoPrompt,
        image: {
            imageBytes: referenceImage.base64,
            mimeType: referenceImage.mimeType,
        },
        config: {
            numberOfVideos: 1
        }
    });

    onProgress('Video generation started. This may take a few minutes.', 10);
    const maxProgressFromApi = 95;
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
        
        if (operation.metadata) {
            const metadata = operation.metadata as any;
            const stateMessage = metadata.progressMessage || metadata.state || 'Processing...';
            const apiPercentage = metadata.progressPercentage || 10;
            const scaledPercentage = Math.min(maxProgressFromApi, 10 + (apiPercentage / 100) * (maxProgressFromApi - 10));
            onProgress(stateMessage, scaledPercentage);
        }
    }
    
    onProgress('Finalizing video...', maxProgressFromApi);

    if (operation.error) {
        console.error(`Video generation operation failed:`, operation.error);
        let detailedError = "An unknown error occurred.";
        const errorObj = operation.error as any;

        if (errorObj && typeof errorObj.message === 'string' && errorObj.message) {
            detailedError = errorObj.message;
        } 
        else if (errorObj) {
            try {
                const stringifiedError = JSON.stringify(errorObj);
                if (stringifiedError !== '{}') {
                    detailedError = stringifiedError;
                }
            } catch (e) {
                detailedError = "A complex error object was returned. See the browser console for details.";
            }
        }

        throw new Error(`Video generation failed: ${detailedError}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        console.error("Full API Response:", JSON.stringify(operation, null, 2));
        throw new Error(`Video generation finished, but no download link was provided by the API. This can sometimes be caused by safety policy violations in the page text.`);
    }
    
    onProgress('Fetching generated video...', 98);
    const videoWithAudioUrl = `${downloadLink}&key=${API_KEY}`;
    const response = await fetch(videoWithAudioUrl);
    if (!response.ok) {
        throw new Error(`Failed to download the generated video. Status: ${response.status}`);
    }
    const videoBlob = await response.blob();
    
    // Save the video to IndexedDB for persistence
    await saveVideo(book.id, page.id, videoBlob);

    const finalVideoUrl = URL.createObjectURL(videoBlob);
    
    onProgress('Complete!', 100);
    return { videoUrl: finalVideoUrl };
}
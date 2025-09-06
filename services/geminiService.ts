import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
// FIX: Imported `GeneratedBook` and fixed incorrect `Book` type usage.
import { InitialIdea, Page, Book, Revision, CaptureData, GeneratedBook } from '../types';
import { compressImageBase64 } from "../utils/imageUtils";

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
        case 'audio':
             interpretationPrompt = `
              ${userTextPrompt}
              The user also narrated this part of the story: "${capture.transcript}".
              Synthesize both the text prompt and the narration to write a story page for a ${age}-year-old.
              Create a detailed illustrator prompt based on this combination.
              ${contextPrompt}`;
             modelParts.push({ text: interpretationPrompt });
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
    const referenceImage = idea.imageBase64 && idea.imageMimeType
        ? { base64: idea.imageBase64, mimeType: idea.imageMimeType }
        : undefined;
    
    const imageBase64 = await generateImage(prompt, style, referenceImage);
    return processAndCompressImage(imageBase64);
}


export async function generateCoverAndFirstPage(idea: InitialIdea, age: number, style: string, onProgress: (message: string) => void): Promise<{ title: string; subtitle: string; characters: string; coverImageUrl: string; firstPage: Page }> {
    if (idea.capture) {
        // Capture-based generation is quick, so we won't add detailed progress here.
        return generateCoverAndFirstPageFromCapture(idea.capture, age, style);
    }
    
    onProgress('Step 1/3: Writing the beginning...');
    const ageInstructions = getAgeAppropriateInstructions(age);
    const ideaPrompt = idea.text || "a story about a brave little bear";
    const prompt = `
      You are an expert children's book author. Your task is to generate content for a storybook for a ${age}-year-old child.
      Follow these age-specific guidelines strictly:
      ${ageInstructions}

      The user's story idea is: "${ideaPrompt}".

      Based on the idea and the age guidelines, generate:
      1. A short, simple, and magical story title.
      2. A 1-line subtitle.
      3. A brief description of the main characters.
      4. The text for the very first page.
    `;

    const modelParts: any[] = [{ text: prompt }];
    if (idea.imageBase64 && idea.imageMimeType) {
        modelParts.push({ inlineData: { mimeType: idea.imageMimeType, data: idea.imageBase64 } });
    }
    if (idea.videoBase64 && idea.videoMimeType) {
        modelParts.push({ inlineData: { mimeType: idea.videoMimeType, data: idea.videoMimeType } });
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
                    firstPageText: { type: Type.STRING }
                }
            }
        }
    });

    const { title, subtitle, characters, firstPageText } = JSON.parse(response.text);

    onProgress('Step 2/3: Designing the cover...');
    const initialReference = idea.imageBase64 && idea.imageMimeType
        ? { base64: idea.imageBase64, mimeType: idea.imageMimeType }
        : undefined;

    const storyIdea = idea.text ? ` The story is about: "${idea.text}".` : '';
    const coverImagePrompt = `A beautiful illustration for the cover of a children's book. The book title is "${title}". This title text MUST be written clearly and creatively on the image. The scene should visually represent the story's theme and feature the main characters: ${characters}.${storyIdea} The visual style should be appropriate for a ${age}-year-old.`;
    const coverImageBase64 = await generateImage(coverImagePrompt, style, initialReference);

    onProgress('Step 3/3: Illustrating the first page...');
    const firstPageImagePrompt = `An illustration for the very first page of a story, which must be different from the cover. The scene is: "${firstPageText}". The characters are: ${characters}. Maintain the same art style and character design as the provided reference image. The visual complexity must be appropriate for a ${age}-year-old. IMPORTANT: Do NOT include any text, letters, or words in this image.`;
    const firstPageImageBase64 = await generateImage(
        firstPageImagePrompt,
        style,
        { base64: coverImageBase64, mimeType: 'image/png' } // Use cover as reference
    );
    
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
                type: 'initial'
            }],
            currentRevisionIndex: 0
        }
    };
}

async function generateCoverAndFirstPageFromCapture(capture: CaptureData, age: number, style: string): Promise<{ title: string; subtitle: string; characters: string; coverImageUrl: string; firstPage: Page }> {
    const interpretation = await interpretCapture(capture, age, "This is for the very first page of a new book. Suggest a title, subtitle and characters.");
    const { title, subtitle, characters, pageText, imagePrompt } = interpretation;

    const styleInstruction = capture.type === 'drawing' && capture.mimicStyle 
        ? "Mimic the simple, charming style of the provided child's drawing."
        : style;

    const coverImageBase64 = await generateImage(
        `A beautiful illustration for the cover of a children's book. The book title is "${title}". This title MUST be written clearly and creatively on the image. The scene should feature the main characters: ${characters}.`, 
        styleInstruction, 
        { base64: capture.base64, mimeType: capture.mimeType }
    );

    const firstPageImageBase64 = await generateImage(
        `${imagePrompt} The characters are: ${characters}. This illustration is for the first page, not the cover. IMPORTANT: Do not include any text, letters, or words in this image.`, 
        styleInstruction,
        { base64: coverImageBase64, mimeType: 'image/png' } // Use cover for consistency
    );
    
    return {
        title: title || 'A Wonderful Story',
        subtitle: subtitle || '',
        characters: characters || 'A friendly character',
        coverImageUrl: await processAndCompressImage(coverImageBase64),
        firstPage: {
            id: generateId(),
            revisions: [{
                text: pageText,
                imageUrl: await processAndCompressImage(firstPageImageBase64),
                type: 'initial',
                capture: capture,
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

        The user's story idea is: "${ideaPrompt}".

        Based on the idea and the age guidelines, provide:
        1. The book title.
        2. A 1-line subtitle.
        3. A brief description of the main characters.
        4. For each of the pages, provide:
            - "pageText": The text for the page.
            - "imagePrompt": A detailed prompt for an illustrator that matches the text and follows the age-specific visual guidelines. The prompts should describe the scene and characters clearly to maintain consistency. These prompts MUST NOT contain instructions to write text.
    `;

    const modelParts: any[] = [{ text: prompt }];
    if (idea.imageBase64 && idea.imageMimeType) {
        modelParts.push({ inlineData: { mimeType: idea.imageMimeType, data: idea.imageBase64 } });
    }
    if (idea.videoBase64 && idea.videoMimeType) {
        modelParts.push({ inlineData: { mimeType: idea.videoMimeType, data: idea.videoMimeType } });
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

    onProgress('Step 2/3: Designing the beautiful cover...');
    const initialReference = idea.imageBase64 && idea.imageMimeType
        ? { base64: idea.imageBase64, mimeType: idea.imageMimeType }
        : undefined;

    const coverImagePrompt = `A beautiful illustration for the cover of a children's book. The book title is "${bookData.title}". This title MUST be written clearly and creatively on the image. The scene should feature the characters: ${bookData.characters}. The visual complexity must be appropriate for a ${age}-year-old.`;
    const coverImageBase64 = await generateImage(coverImagePrompt, style, initialReference);

    const pages: Page[] = [];
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

        pages.push({
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
        pages: pages,
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
    if (nextIdea.imageBase64 && nextIdea.imageMimeType) {
        modelParts.push({ inlineData: { mimeType: nextIdea.imageMimeType, data: nextIdea.imageBase64 } });
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
    } else { // 'image'
        const imagePrompt = `${revisionPromptOrCapture}.${characterInfo} IMPORTANT: Do not add any text, letters, or words to the image.`;
        const imageBase64 = await generateImage(imagePrompt, style, referenceImage);
        newImageUrl = await processAndCompressImage(imageBase64);
    }
    
    return { newRevision: { text: newText, imageUrl: newImageUrl, type: revisionType } };
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

async function createSafeVideoPrompt(pageText: string): Promise<string> {
    const prompt = `
        You are an AI Safety Guard. Your only job is to rewrite a story sentence into an ultra-safe, simple, positive, and child-friendly visual prompt for a video AI. You must be extremely cautious. Failure to follow these rules will result in a failed video.

        **NON-NEGOTIABLE RULES:**

        1.  **ABSOLUTE POSITIVITY:** The output MUST be gentle, happy, and describe a single, clear, positive action. There can be NO conflict, NO sadness, NO fear, NO danger, not even implied.
        2.  **MANDATORY WORD REPLACEMENT (NO EXCEPTIONS - THIS IS CRITICAL):**
            *   "fight", "battle", "attack", "hit", "scary", "afraid", "danger", "chase", "mean" -> "playful dance", "happy game", "silly wiggle", "gentle tag"
            *   "cried", "sad", "lost", "alone", "dark", "night", "storm", "scared" -> "giggling", "thinking", "exploring", "on a fun adventure", "sparkling", "starry sky", "gentle rain"
            *   "monster", "dragon", "ghost", "villain" -> "big fluffy friend", "glowing magical pal", "silly flying creature", "playful character"
            *   "fire", "burning", "explode", "crash", "fall" -> "warm glowing light", "colorful sparkles", "magical poof", "gentle landing"
            *   "problem", "secret", "bad", "wrong", "trick" -> "fun puzzle", "happy surprise", "silly", "different", "fun game"
        3.  **STRICT OUTPUT FORMAT:**
            *   Your entire response must be ONLY the rewritten prompt. No preamble.
            *   It must be a single, short sentence. (e.g., "A fluffy creature is dancing under a starry sky.")
            *   It must describe a simple, visual action. (e.g., "A character is jumping on a soft cloud.")
            *   It must be literal and concrete. NO metaphors. NO abstract ideas.

        **Your Task:**
        Rewrite the following text into a safe visual prompt, following all rules perfectly. Original Text: "${pageText}"
    `;
    const response = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
    });
    return response.text.trim();
}

export async function generateSinglePageVideo(
    book: Book,
    page: Page,
): Promise<{ videoUrl: string }> {
    const pageText = page.revisions[page.currentRevisionIndex].text;
    const safePageDescription = await createSafeVideoPrompt(pageText);

    const videoPrompt = `
        An animated video scene for a children's story, in the style of "${book.style}".
        The scene is for a ${book.age}-year-old.
        The animation should be magical, vibrant, and child-friendly, matching the reference image.
        The video MUST include a voiceover of a friendly narrator reading the following text aloud: "${pageText}"
        Animate this scene: "${safePageDescription}".
    `;

    const [header, base64] = page.revisions[page.currentRevisionIndex].imageUrl.split(',');
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const referenceImage = { base64, mimeType };

    if (!referenceImage.base64 || !referenceImage.mimeType) {
        throw new Error(`Reference image for page video is invalid.`);
    }

    let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: videoPrompt,
        image: {
            imageBytes: referenceImage.base64,
            mimeType: referenceImage.mimeType,
        },
        config: {
            numberOfVideos: 1
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        console.error(`Video generation operation failed:`, operation.error);
        let detailedError = "An unknown error occurred.";
        const errorObj = operation.error as any;

        // Check for a standard error message property
        if (errorObj && typeof errorObj.message === 'string' && errorObj.message) {
            detailedError = errorObj.message;
        } 
        // If no message, try to stringify the whole object
        else if (errorObj) {
            try {
                const stringifiedError = JSON.stringify(errorObj);
                // Avoid showing an empty object
                if (stringifiedError !== '{}') {
                    detailedError = stringifiedError;
                }
            } catch (e) {
                // Fallback if stringify fails (e.g., circular reference)
                detailedError = "A complex error object was returned. See the browser console for details.";
            }
        }

        let finalMessage = `Video generation failed: ${detailedError}`;

        // Check for safety filter issues and provide a more specific message
        if (detailedError.toLowerCase().includes('sensitive') || detailedError.toLowerCase().includes('safety') || detailedError.toLowerCase().includes('violate')) {
            finalMessage = `The AI's safety filter blocked the video creation. We tried to rewrite the prompt automatically, but it was still flagged. Please try revising this page's text to be simpler and more positive.`;
        }
        
        throw new Error(finalMessage);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error(`Video generation finished, but no download link was found. This is often due to the prompt being blocked by safety filters.`);
    }
    
    const videoUrl = `${downloadLink}&key=${API_KEY}`;
    return { videoUrl };
}
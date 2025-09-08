import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const textModel = 'gemini-2.5-flash';

function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

export async function generateNarration(text: string, age: number): Promise<Blob> {
    const voiceStyle = age <= 6 ? "a gentle and enthusiastic voice, like a friendly cartoon character" : "a clear, warm, and engaging storyteller voice";

    const prompt = `
        You are an advanced text-to-speech engine.
        Your task is to convert the provided text into a high-quality audio file.
        The narration voice should be ${voiceStyle}, suitable for a ${age}-year-old child.
        The output must be ONLY a JSON object containing a single key "audioContent" with the base64 encoded MP3 audio data.
        Do not include any other text, explanation, or markdown formatting.

        Text to convert: "${text}"
    `;

    const response = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    audioContent: { type: Type.STRING }
                }
            }
        }
    });

    const result = JSON.parse(response.text);
    if (!result.audioContent) {
        throw new Error("AI did not return audio content for narration.");
    }
    
    return base64ToBlob(result.audioContent, 'audio/mpeg');
}
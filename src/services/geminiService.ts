import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

/**
 * Lazy initialization of GoogleGenAI SDK client.
 * Never crashes on startup if the key is not yet set.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required for server-side AI features');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

/**
 * Server-side Gemini content generation function.
 * Kept strictly server-side.
 */
export async function generateContentServerSide(
  prompt: string,
  model = 'gemini-2.5-flash'
): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });
  return response.text || '';
}

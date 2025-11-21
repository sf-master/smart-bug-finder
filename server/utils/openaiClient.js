import OpenAI from "openai";

// Export a configured client targeting Groq's OpenAI-compatible endpoint
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});
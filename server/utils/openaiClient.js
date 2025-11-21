import OpenAI from "openai";

// Export a configured OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});
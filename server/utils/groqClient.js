import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// Export a configured Groq (OpenAI-compatible) client
export const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Convenience helper for single-call usage
export async function groqRespond({
  model = process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  input,
  temperature = 0.2,
}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const response = await groqClient.responses.create({
    model,
    input,
    temperature,
  });

  return {
    text: response.output_text ?? "",
    raw: response,
  };
}

// Example (uncomment to test with node):
// (async () => {
//   const res = await groqRespond({ input: "Explain the importance of fast language models" });
//   console.log(res.text);
// })();


import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";

const ollamaClient = axios.create({
  baseURL: OLLAMA_BASE_URL
});

const truncate = (text = "", max = 18000) =>
  text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;

export const analyzeScanData = async ({
  url,
  dom,
  consoleErrors = [],
  networkErrors = [],
  screenshot
}) => {
  if (!OLLAMA_MODEL) {
    return {
      bugs: [],
      fixes: [],
      suggestions: [],
      rawLLMResponse: { error: "Missing OLLAMA_MODEL" }
    };
  }

  const consoleSection =
    consoleErrors.length > 0
      ? consoleErrors
          .map(
            (err, idx) =>
              `${idx + 1}. ${err.text || "Console error"} @ ${
                err.location?.url ?? "unknown"
              }:${err.location?.lineNumber ?? "-"}`
          )
          .join("\n")
      : "None";

  const networkSection =
    networkErrors.length > 0
      ? networkErrors
          .map(
            (n, idx) =>
              `${idx + 1}. [${n.status}] ${n.url} - ${n.statusText || ""}`
          )
          .join("\n")
      : "None";

  const prompt = `
You are Smart Bug Finder, an AI for UI bug detection and accessibility analysis.

Return valid JSON ONLY:

{
  "bugs": [{ "title": "", "description": "", "severity": "" }],
  "fixes": ["string"],
  "suggestions": ["string"]
}

Scan Data:
URL: ${url}

DOM (truncated):
${truncate(dom)}

Console Errors:
${consoleSection}

Network Errors:
${networkSection}

Screenshot length: ${screenshot?.length || 0}
`;

  try {
    const response = await ollamaClient.post("/api/generate", {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2
      }
    });

    const jsonText = response.data?.response ?? "{}";

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = {};
    }

    return {
      bugs: parsed.bugs || [],
      fixes: parsed.fixes || [],
      suggestions: parsed.suggestions || [],
      rawLLMResponse: parsed
    };
  } catch (error) {
    console.error("Ollama request failed:", error.message);
    return {
      bugs: [],
      fixes: [],
      suggestions: [],
      rawLLMResponse: {
        error: error.message,
        details: error.response?.data || null
      }
    };
  }
};

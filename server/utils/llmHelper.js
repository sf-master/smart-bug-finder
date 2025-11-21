import { openai } from "./openaiClient.js";
import dotenv from "dotenv";
import axios from "axios";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // Default to a common OpenAI model

const truncate = (text = "", max = 18000) =>
  text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;

export const analyzeScanData = async ({
  url,
  dom,
  consoleErrors = [],
  networkErrors = [],
  screenshot
}) => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      bugs: [],
      fixes: [],
      suggestions: [],
      rawLLMResponse: { error: "Missing OPENAI_API_KEY" }
    };
  }
  if (!OPENAI_MODEL) {
    return {
      bugs: [],
      fixes: [],
      suggestions: [],
      rawLLMResponse: { error: "Missing OPENAI_MODEL" }
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

  const systemMessage = `
You are Smart Bug Finder, an AI for UI bug detection and accessibility analysis.
Your task is to analyze the provided scan data (URL, DOM, console errors, network errors, and screenshot information) and identify potential UI bugs, provide fixes, and suggest improvements.

Return your response in valid JSON ONLY, strictly adhering to the following schema:

{
  "bugs": [
    {
      "title": "Concise bug title",
      "description": "Detailed description of the bug, including its impact.",
      "severity": "low | medium | high | critical"
    }
  ],
  "fixes": [
    "Suggested fix 1 for identified bugs or issues.",
    "Suggested fix 2."
  ],
  "suggestions": [
    "General suggestion 1 for UI/UX or accessibility improvement.",
    "General suggestion 2."
  ]
}

Ensure all fields are populated even if with "N/A" or "None" if no relevant information is found.
`;

  const userMessage = `
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
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" } // Ensure JSON output
    });

    const jsonText = response.choices[0]?.message?.content ?? "{}";

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON:", e);
      parsed = {};
    }

    return {
      bugs: parsed.bugs || [],
      fixes: parsed.fixes || [],
      suggestions: parsed.suggestions || [],
      rawLLMResponse: parsed
    };
  } catch (error) {
    console.error("OpenAI request failed:", error.message);
    return {
      bugs: [],
      fixes: [],
      suggestions: [],
      rawLLMResponse: {
        error: error.message,
        details: error.response?.data || null // For axios errors
      }
    };
  }
};

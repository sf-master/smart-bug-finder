import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMP_DIR = join(__dirname, "..", "temp", "gemini-response");

// Export a configured Gemini client
export const geminiClient = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
);

/**
 * Saves the Gemini response to a JSON file in temp/gemini-response/
 * @param {Object} response - The response object to save
 * @param {string} url - The URL that was analyzed (for filename)
 * @returns {string} Path to the saved file
 */
function saveResponse(response, url) {
  try {
    // Create directory if it doesn't exist
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Generate filename: sanitize URL and add timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const urlSlug = url
      .replace(/https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50); // Limit length
    
    const filename = `${urlSlug}_${timestamp}.json`;
    const filepath = join(TEMP_DIR, filename);

    // Prepare response data with metadata
    const responseData = {
      metadata: {
        url: url,
        timestamp: new Date().toISOString(),
        model: process.env.GEMINI_MODEL || "gemini-pro-latest",
      },
      response: response,
    };

    // Write to file
    writeFileSync(filepath, JSON.stringify(responseData, null, 2), "utf8");
    
    return filepath;
  } catch (error) {
    console.error("Failed to save Gemini response:", error.message);
    return null;
  }
}

/**
 * JSON Schema for structured output - ensures consistent response format
 */
const bugReportSchema = {
  type: "object",
  properties: {
    bugs: {
      type: "array",
      description: "Array of detected bugs/issues",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short title/name of the bug"
          },
          description: {
            type: "string",
            description: "Detailed description of the bug, including where it occurs and what the issue is"
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Severity level of the bug"
          }
        },
        required: ["title", "description", "severity"]
      }
    },
    fixes: {
      type: "array",
      description: "Array of suggested fixes for the detected bugs",
      items: {
        type: "string",
        description: "A specific fix or solution for one or more bugs"
      }
    },
    suggestions: {
      type: "array",
      description: "Array of general suggestions for improvement (accessibility, performance, UX, etc.)",
      items: {
        type: "string",
        description: "A suggestion for improving the website"
      }
    }
  },
  required: ["bugs", "fixes", "suggestions"]
};

/**
 * Analyzes website scan data using Gemini with structured output
 * @param {Object} params - Analysis parameters
 * @param {string} params.url - The URL that was scanned
 * @param {string} params.dom - HTML DOM content
 * @param {Array} params.consoleErrors - Array of console errors
 * @param {Array} params.networkErrors - Array of network errors
 * @param {string} params.screenshot - Base64 encoded screenshot (optional)
 * @param {string} params.model - Gemini model to use (default: gemini-pro-latest)
 * @param {number} params.temperature - Temperature for generation (default: 0.2)
 * @returns {Promise<Object>} Structured analysis result with bugs, fixes, and suggestions
 */
export async function analyzeScanDataWithGemini({
  url,
  dom,
  consoleErrors = [],
  networkErrors = [],
  screenshot,
  model = process.env.GEMINI_MODEL || "gemini-2.5-flash",
  temperature = 0.2,
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const truncate = (text = "", max = 50000) =>
    text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;

  // Format console errors
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

  // Format network errors
  const networkSection =
    networkErrors.length > 0
      ? networkErrors
          .map(
            (n, idx) =>
              `${idx + 1}. [${n.status}] ${n.url} - ${n.statusText || ""}`
          )
          .join("\n")
      : "None";

  // Build the analysis prompt
  const prompt = `You are Smart Bug Finder, an AI expert specializing in UI bug detection, accessibility analysis, and web development best practices.

Analyze the following website scan data and provide a comprehensive report.

**Website URL:** ${url}

**HTML DOM Content (truncated):**
${truncate(dom)}

**Console Errors:**
${consoleSection}

**Network Errors (4xx/5xx):**
${networkSection}

**Screenshot:** ${screenshot ? `Available (${screenshot.length} characters base64)` : "Not available"}

**Your Task:**
1. **Bugs**: Identify specific bugs, issues, or problems in the website. Include:
   - UI/UX issues (broken layouts, overlapping elements, responsive design problems)
   - Accessibility issues (missing alt text, poor contrast, keyboard navigation problems)
   - JavaScript errors and their impact
   - Network errors and their implications
   - Performance issues visible in the DOM or errors
   - Security concerns (if any)

2. **Fixes**: Provide actionable fixes for each bug. Be specific with code examples or clear instructions.

3. **Suggestions**: Offer general improvements for:
   - Accessibility enhancements
   - Performance optimizations
   - User experience improvements
   - Code quality improvements
   - Best practices

**Important Guidelines:**
- Be thorough but concise
- Prioritize bugs by severity (critical > high > medium > low)
- Provide practical, implementable fixes
- Focus on issues that affect user experience or accessibility
- If no bugs are found, still provide suggestions for improvement

Return your analysis in the specified JSON format.`;

  try {
    // Get the generative model
    const genModel = geminiClient.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: temperature,
        responseMimeType: "application/json",
        responseSchema: bugReportSchema,
      },
    });

    console.log(`🤖 Analyzing with Gemini (${model})...`);

    // Generate content with structured output
    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON response:", parseError);
      console.error("Raw response:", jsonText);
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Invalid JSON response from Gemini");
      }
    }

    // Validate and normalize the response structure
    const normalized = {
      bugs: Array.isArray(parsed.bugs) ? parsed.bugs : [],
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      rawLLMResponse: parsed,
    };

    // Ensure bugs have required fields
    normalized.bugs = normalized.bugs.map((bug) => ({
      title: bug.title || "Untitled Bug",
      description: bug.description || "No description provided",
      severity: bug.severity || "medium",
    }));

    console.log(`✅ Gemini analysis complete: ${normalized.bugs.length} bugs, ${normalized.fixes.length} fixes, ${normalized.suggestions.length} suggestions`);

    // Save response to temp directory
    const savedPath = saveResponse(normalized, url);
    if (savedPath) {
      console.log(`💾 Response saved to: ${savedPath}`);
    }

    return normalized;
  } catch (error) {
    console.error("❌ Gemini request failed:", error.message);
    console.error("Error details:", error);

    return {
      bugs: [],
      fixes: [],
      suggestions: [],
      rawLLMResponse: {
        error: error.message,
        details: error.stack || null,
      },
    };
  }
}

/**
 * Convenience helper for simple text generation with Gemini
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - The prompt to send
 * @param {string} params.model - Model to use (default: gemini-1.5-pro)
 * @param {number} params.temperature - Temperature (default: 0.7)
 * @returns {Promise<string>} Generated text response
 */
export async function geminiGenerateText({
  prompt,
  model = process.env.GEMINI_MODEL || "gemini-pro-latest",
  temperature = 0.7,
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const genModel = geminiClient.getGenerativeModel({
    model: model,
    generationConfig: {
      temperature: temperature,
    },
  });

  const result = await genModel.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

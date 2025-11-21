import OpenAI from "openai";

// Lazy initialization to prevent startup crash if API key is missing
let _openaiClient = null;

const getClient = () => {
  if (!_openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing or empty");
    }
    try {
      _openaiClient = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.openai.com/v1",
      });
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }
  return _openaiClient;
};

// Proxy for lazy initialization - only creates client when accessed
export const openai = new Proxy({}, {
  get(target, prop) {
    try {
      return getClient()[prop];
    } catch (error) {
      // Re-throw with clearer message if accessed without API key
      throw new Error(`OpenAI client unavailable: ${error.message}`);
    }
  }
});
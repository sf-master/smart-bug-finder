import { analyzeScanDataWithGemini } from "./utils/geminiClient.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file explicitly
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Dummy test data
const dummyData = {
  url: "https://example.com",
  dom: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Website</title>
</head>
<body>
    <header>
        <h1>Welcome to Test Site</h1>
        <img src="logo.png" alt=""> <!-- Missing alt text -->
    </header>
    
    <main>
        <button onclick="undefinedFunction()">Click Me</button> <!-- Will cause JS error -->
        <div style="color: #ccc; background: #ccc;">Poor contrast text</div>
        <a href="#" style="display: none;">Hidden link</a>
        <form>
            <input type="text" id="email" name="email">
            <label for="email">Email</label> <!-- Label after input -->
        </form>
        
        <div class="container" style="width: 2000px;">
            <p>This container is too wide and will cause horizontal scroll on mobile</p>
        </div>
        
        <script>
            // Simulated error
            console.error("ReferenceError: undefinedFunction is not defined");
        </script>
    </main>
    
    <footer>
        <p>&copy; 2024 Test Site</p>
    </footer>
</body>
</html>
  `.trim(),
  consoleErrors: [
    {
      text: "ReferenceError: undefinedFunction is not defined",
      location: {
        url: "https://example.com/index.html",
        lineNumber: 15
      }
    },
    {
      text: "Failed to load resource: net::ERR_FILE_NOT_FOUND",
      location: {
        url: "https://example.com/logo.png",
        lineNumber: 8
      }
    }
  ],
  networkErrors: [
    {
      url: "https://example.com/api/data",
      status: 404,
      statusText: "Not Found"
    },
    {
      url: "https://example.com/styles.css",
      status: 500,
      statusText: "Internal Server Error"
    }
  ],
  screenshot: "dummy_base64_screenshot_data_placeholder"
};

console.log("🧪 Testing Gemini Client with Dummy Data\n");
console.log("=" .repeat(60));
console.log(`URL: ${dummyData.url}`);
console.log(`DOM Length: ${dummyData.dom.length} characters`);
console.log(`Console Errors: ${dummyData.consoleErrors.length}`);
console.log(`Network Errors: ${dummyData.networkErrors.length}`);
console.log("=" .repeat(60));
console.log("\n");

async function testGemini() {
  try {
    // Debug: Check if API key is loaded
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY is not set in environment variables");
      console.log(`\n.env file path: ${envPath}`);
      console.log(`.env file exists: ${existsSync(envPath)}`);
      console.log("\nPlease ensure GEMINI_API_KEY is set in your .env file");
      console.log("Format: GEMINI_API_KEY=your_api_key_here");
      process.exit(1);
    }
    
    console.log(`✅ GEMINI_API_KEY loaded (length: ${apiKey.length} characters)`);
    console.log(`📝 Using model: ${process.env.GEMINI_MODEL || "gemini-pro-latest"}\n`);

    console.log("🚀 Calling analyzeScanDataWithGemini...\n");

    const startTime = Date.now();
    const result = await analyzeScanDataWithGemini(dummyData);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=" .repeat(60));
    console.log("✅ Test Completed Successfully!");
    console.log(`⏱️  Duration: ${duration}s`);
    console.log("=" .repeat(60));
    console.log("\n");

    // Display results
    console.log("📊 RESULTS:\n");

    console.log(`🐛 Bugs Found: ${result.bugs.length}`);
    if (result.bugs.length > 0) {
      result.bugs.forEach((bug, index) => {
        console.log(`\n  ${index + 1}. [${bug.severity.toUpperCase()}] ${bug.title}`);
        console.log(`     ${bug.description}`);
      });
    } else {
      console.log("  No bugs detected.");
    }

    console.log(`\n🔧 Fixes Suggested: ${result.fixes.length}`);
    if (result.fixes.length > 0) {
      result.fixes.forEach((fix, index) => {
        console.log(`  ${index + 1}. ${fix}`);
      });
    } else {
      console.log("  No fixes suggested.");
    }

    console.log(`\n💡 Suggestions: ${result.suggestions.length}`);
    if (result.suggestions.length > 0) {
      result.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
    } else {
      console.log("  No suggestions provided.");
    }

    console.log("\n" + "=" .repeat(60));
    console.log("📋 Full Response Structure:");
    console.log("=" .repeat(60));
    console.log(JSON.stringify(result, null, 2));

    console.log("\n" + "=" .repeat(60));
    console.log("💾 Response saved to temp/gemini-response/ directory");
    console.log("=" .repeat(60));

  } catch (error) {
    console.error("\n❌ Test Failed:");
    console.error("Error:", error.message);
    console.error("\nStack:", error.stack);
    process.exit(1);
  }
}

testGemini();

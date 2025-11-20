import { takeScrollScreenshots, takeFullPageScreenshot } from "./utils/screenshotHelper.js";
import fs from "fs";
import path from "path";

const url = process.argv[2];

if (!url) {
  console.error("❌ Please provide a URL as an argument");
  console.log("Usage: node test-screenshot.js <url>");
  console.log("Example: node test-screenshot.js https://example.com");
  process.exit(1);
}

// Validate URL format
try {
  new URL(url);
} catch {
  console.error("❌ Invalid URL format");
  process.exit(1);
}

console.log(`🚀 Testing screenshot helper for: ${url}\n`);

async function testScreenshots() {
  try {
    console.log("📸 Taking scroll screenshots...\n");
    
    const screenshots = await takeScrollScreenshots(url, {
      scrollStep: 500,
      waitTime: 500,
      headless: true,
    });

    console.log(`\n✅ Successfully captured ${screenshots.length} screenshots\n`);

    // Create output directory
    const outputDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save screenshots to files
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseFilename = url.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_");

    screenshots.forEach((screenshot, index) => {
      const filename = `${baseFilename}_${timestamp}_scroll_${screenshot.scrollPosition}.png`;
      const filepath = path.join(outputDir, filename);
      
      const buffer = Buffer.from(screenshot.screenshot, "base64");
      fs.writeFileSync(filepath, buffer);
      
      console.log(`💾 Saved: ${filename} (scroll position: ${screenshot.scrollPosition}px)`);
    });

    console.log(`\n📁 All screenshots saved to: ${outputDir}`);

    // Also test full-page screenshot
    console.log("\n📸 Taking full-page screenshot...\n");
    const fullPageScreenshot = await takeFullPageScreenshot(url);
    
    const fullPageFilename = `${baseFilename}_${timestamp}_fullpage.png`;
    const fullPageFilepath = path.join(outputDir, fullPageFilename);
    const fullPageBuffer = Buffer.from(fullPageScreenshot, "base64");
    fs.writeFileSync(fullPageFilepath, fullPageBuffer);
    
    console.log(`💾 Saved: ${fullPageFilename}`);
    console.log(`\n✅ Test completed successfully!`);

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testScreenshots();

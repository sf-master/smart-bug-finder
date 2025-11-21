import { chromium } from "playwright";
import { analyzeScanData } from "../utils/llmHelper.js";
import { checkUrlAccessible } from "../utils/urlHelper.js";
import { takeFullPageScreenshot, takeScrollScreenshots } from "../utils/screenshotHelper.js";
import fs from "fs";
import path from "path";

export const scanWebsite = async (req, res) => {
  let browser = null;
  let context = null;
  let page = null;

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Missing url query parameter" });
    }

    // 🔍 Step 1: Validate URL accessibility
    const validation = await checkUrlAccessible(url);

    if (!validation.ok) {
      return res.status(400).json({
        error: "URL is not accessible",
        details: validation.error,
        status: validation.status
      });
    }

    const consoleErrors = [];
    const networkErrors = [];

    // Playwright launch with performance optimizations
    // NOTE: Don't disable images - we need them for screenshots!
    // We'll block fonts/media via route handler instead
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-javascript-harmony-shipping']
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true
    });

    page = await context.newPage();

    // Block unnecessary resources to speed up loading
    // Note: We keep images for screenshots, but block fonts and media
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Block fonts and media - keep images for screenshots
      if (['font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Log console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Log network errors
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) {
        networkErrors.push({
          url: response.url(),
          status,
          statusText: response.statusText()
        });
      }
    });

    console.log(`🔍 Navigating to: ${url}`);

    // Navigate and wait for DOM to be ready
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // For viewport screenshot, we don't need to wait for networkidle
    // Just wait briefly for initial render and some images to load
    await page.waitForTimeout(800); // Brief wait for CSS/JS to render viewport

    const dom = await page.content();

    // Take screenshot of viewport only (what's visible when page first loads)
    const screenshotBuffer = await page.screenshot({ 
      fullPage: false,
      timeout: 5000
    });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    // --- Screenshot File Saving Logic ---
    const outputDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseFilename = url.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_");
    const screenshotFilename = `${baseFilename}_${timestamp}.png`;
    fs.writeFileSync(path.join(outputDir, screenshotFilename), screenshotBuffer);
    // ------------------------------------

    await browser.close();

    const llmResult = await analyzeScanData({
      url,
      dom,
      consoleErrors,
      networkErrors,
      screenshot: screenshotBase64 // Provide one screenshot to the LLM for analysis
    });

    return res.status(200).json({
      url,
      screenshot: screenshotFilename, // Return single filename
      bugs: llmResult.bugs || [],
      fixes: llmResult.fixes || [],
      suggestions: llmResult.suggestions || [],
      rawLLMResponse: llmResult.rawLLMResponse || {}
    });

  } catch (error) {
    console.error("❌ ScanWebsite Error:", error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    return res.status(500).json({
      error: "Failed to scan website",
      details: error.message
    });
  }
};

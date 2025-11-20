import { chromium } from "playwright";
import { analyzeScanData } from "../utils/llmHelper.js";
import { checkUrlAccessible } from "../utils/urlHelper.js";

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

    // Playwright launch
    browser = await chromium.launch({ headless: true });

    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true
    });

    page = await context.newPage();

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

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    // Wait a bit for client-side JS render
    await page.waitForTimeout(3000);

    const dom = await page.content();

    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshot = screenshotBuffer.toString("base64");

    await browser.close();

    // Call LLM (Safe Retry)
    const llmResult = await analyzeScanData({
      url,
      dom,
      consoleErrors,
      networkErrors,
      screenshot
    });

    return res.status(200).json({
      url,
      screenshot,
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

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

    // Playwright launch with performance optimizations
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-images', '--disable-javascript-harmony-shipping']
    });

    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
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

    // Use 'domcontentloaded' first, then wait for networkidle with shorter timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000 // Reduced from 5 minutes to 1 minute
    });

    // Wait for network to settle (with timeout) and client-side JS to render
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // If networkidle times out, continue anyway - DOM is already loaded
    });
    await page.waitForTimeout(1000); // Reduced from 3s to 1s

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

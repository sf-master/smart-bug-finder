import { chromium } from "playwright";

/**
 * Takes screenshots of a website while scrolling from top to bottom
 * @param {string} url - The URL to screenshot
 * @param {Object} options - Configuration options
 * @param {number} options.viewportWidth - Viewport width (default: 1366)
 * @param {number} options.viewportHeight - Viewport height (default: 768)
 * @param {number} options.scrollStep - Pixels to scroll per step (default: 500)
 * @param {number} options.waitTime - Time to wait after each scroll in ms (default: 500)
 * @param {boolean} options.headless - Run in headless mode (default: true)
 * @returns {Promise<Array<{scrollPosition: number, screenshot: string}>>} Array of screenshots with scroll positions
 */
export async function takeScrollScreenshots(url, options = {}) {
  const {
    viewportWidth = 1366,
    viewportHeight = 768,
    scrollStep = 500,
    waitTime = 500,
    headless = true,
  } = options;

  let browser = null;
  let context = null;
  let page = null;

  try {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL format");
    }

    // Launch browser
    browser = await chromium.launch({ headless });

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    page = await context.newPage();

    console.log(`📸 Navigating to: ${url}`);

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait for initial page load
    await page.waitForTimeout(2000);

    const screenshots = [];
    let currentScroll = 0;
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Prevent infinite scrolling

    // Get initial page height
    let pageHeight = await page.evaluate(() => {
      return Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
    });

    console.log(`📏 Page height: ${pageHeight}px`);

    // Scroll from top to bottom, taking screenshots along the way
    while (currentScroll < pageHeight && scrollAttempts < maxScrollAttempts) {
      // Scroll to current position
      await page.evaluate((scrollY) => {
        window.scrollTo(0, scrollY);
      }, currentScroll);

      // Wait for content to load/animations to settle
      await page.waitForTimeout(waitTime);

      // Take screenshot at current scroll position
      const screenshotBuffer = await page.screenshot({ fullPage: false });
      const screenshotBase64 = screenshotBuffer.toString("base64");

      screenshots.push({
        scrollPosition: currentScroll,
        screenshot: screenshotBase64,
      });

      console.log(`📸 Screenshot taken at scroll position: ${currentScroll}px`);

      // Check if page height changed (dynamic content loading)
      const newPageHeight = await page.evaluate(() => {
        return Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
      });

      // Update page height if it increased
      if (newPageHeight > pageHeight) {
        pageHeight = newPageHeight;
      }

      // Move to next scroll position
      currentScroll += scrollStep;

      // If we haven't moved, break to avoid infinite loop
      if (currentScroll === previousHeight) {
        break;
      }

      previousHeight = currentScroll;
      scrollAttempts++;
    }

    // Take final screenshot at the bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(waitTime);

    const finalScreenshotBuffer = await page.screenshot({ fullPage: false });
    const finalScreenshotBase64 = finalScreenshotBuffer.toString("base64");

    screenshots.push({
      scrollPosition: pageHeight,
      screenshot: finalScreenshotBase64,
    });

    console.log(`✅ Total screenshots taken: ${screenshots.length}`);

    await browser.close();

    return screenshots;
  } catch (error) {
    console.error("❌ Screenshot Helper Error:", error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    throw error;
  }
}

/**
 * Takes a single full-page screenshot
 * @param {string} url - The URL to screenshot
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} Base64 encoded screenshot
 */
export async function takeFullPageScreenshot(url, options = {}) {
  const {
    viewportWidth = 1366,
    viewportHeight = 768,
    headless = true,
  } = options;

  let browser = null;
  let context = null;
  let page = null;

  try {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL format");
    }

    // Launch browser
    browser = await chromium.launch({ headless });

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    page = await context.newPage();

    console.log(`📸 Taking full-page screenshot of: ${url}`);

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Take full-page screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    await browser.close();

    return screenshotBase64;
  } catch (error) {
    console.error("❌ Full Page Screenshot Error:", error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    throw error;
  }
}

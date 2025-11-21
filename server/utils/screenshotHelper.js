import { chromium } from "playwright";

/**
 * Takes screenshots of a website while scrolling from top to bottom
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {Object} options - Configuration options
 * @param {number} options.scrollStep - Pixels to scroll per step (default: 500)
 * @param {number} options.waitTime - Time to wait after each scroll in ms (default: 500)
 * @returns {Promise<Array<{scrollPosition: number, screenshot: string}>>} Array of screenshots with scroll positions
 */
export async function takeScrollScreenshots(page, options = {}) {
  const {
    scrollStep = 500,
    waitTime = 500,
  } = options;

  let browser = null;
  let context = null;

  try {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL format");
    }

    // Launch browser with performance optimizations
    browser = await chromium.launch({ 
      headless,
      args: ['--disable-javascript-harmony-shipping']
    });

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    page = await context.newPage();

    // Block fonts and media to speed up loading (keep images for screenshots)
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    console.log(`📸 Navigating to: ${url}`);

    // Navigate to the URL with faster wait strategy
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000, // Reduced from 5 minutes to 1 minute
    });

    // Wait for network to settle (with timeout) and page to render
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // If networkidle times out, continue anyway
    });
    await page.waitForTimeout(1000); // Reduced from 2s to 1s

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

    return screenshots;
  } catch (error) {
    console.error("❌ Screenshot Helper Error:", error);
    throw error;
  }
}

/**
 * Takes a single full-page screenshot
 * @param {import('playwright').Page} page - The Playwright page object
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

    // Launch browser with performance optimizations
    browser = await chromium.launch({ 
      headless,
      args: ['--disable-javascript-harmony-shipping']
    });

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    page = await context.newPage();

    // Block fonts and media to speed up loading (keep images for screenshots)
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    console.log(`📸 Taking full-page screenshot of: ${url}`);

    // Navigate to the URL with faster wait strategy
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000, // Reduced from 5 minutes to 1 minute
    });

    // Wait for network to settle (with timeout) and page to render
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // If networkidle times out, continue anyway
    });
    await page.waitForTimeout(1000); // Reduced from 2s to 1s

    // Take full-page screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshotBase64 = screenshotBuffer.toString("base64");
    
    return screenshotBase64;
  } catch (error) {
    console.error("❌ Full Page Screenshot Error:", error);
    throw error;
  }
}

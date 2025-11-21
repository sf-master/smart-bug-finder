import axios from 'axios';
import { chromium } from 'playwright';
import { escapeCSSSelector, findElementWithMultipleStrategies } from '../utils/elementFinder.js';

/**
 * Validates a URL and checks if a link is reachable
 */
const validateLink = async (href, baseUrl) => {
  if (!href) {
    return {
      status: 'invalidHref',
      ok: false,
      errorMessage: 'Missing href attribute'
    };
  }

  try {
    // Resolve relative URLs
    const resolvedUrl = new URL(href, baseUrl).href;
    const baseHost = new URL(baseUrl).hostname;
    const linkHost = new URL(resolvedUrl).hostname;
    const sameOrigin = baseHost === linkHost;

    // Try to fetch the link (HEAD request first, fallback to GET)
    try {
      const response = await axios.head(resolvedUrl, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: () => true // Don't throw on any status
      });

      return {
        status: response.status >= 200 && response.status < 400 ? 'valid' : 'broken',
        statusCode: response.status,
        ok: response.status >= 200 && response.status < 400,
        sameOrigin,
        errorMessage: response.status >= 400 ? `HTTP ${response.status}` : undefined
      };
    } catch (headError) {
      // Fallback to GET if HEAD fails
      try {
        const response = await axios.get(resolvedUrl, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: () => true,
          maxContentLength: 1024 // Only fetch small amount for validation
        });

        return {
          status: response.status >= 200 && response.status < 400 ? 'valid' : 'broken',
          statusCode: response.status,
          ok: response.status >= 200 && response.status < 400,
          sameOrigin,
          errorMessage: response.status >= 400 ? `HTTP ${response.status}` : undefined
        };
      } catch (getError) {
        return {
          status: 'broken',
          ok: false,
          sameOrigin,
          errorMessage: getError.message || 'Unable to reach URL'
        };
      }
    }
  } catch (error) {
    return {
      status: 'invalidHref',
      ok: false,
      errorMessage: error.message || 'Invalid URL format'
    };
  }
};

/**
 * Analyzes the HEAD section of the document using Playwright
 */
const analyzeHead = async (page, baseUrl) => {
  const headData = await page.evaluate(() => {
    const head = document.head;
    const analysis = {
      title: {
        hasTitle: false,
        titleText: null
      },
      metaTags: [],
      linkTags: []
    };

    // Analyze title
    const titleElement = head.querySelector('title');
    if (titleElement) {
      analysis.title.hasTitle = true;
      analysis.title.titleText = titleElement.textContent?.trim() || null;
    }

    // Analyze meta tags
    const metaTags = head.querySelectorAll('meta');
    metaTags.forEach((meta) => {
      analysis.metaTags.push({
        nameOrProperty: meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv') || null,
        contentOrValue: meta.getAttribute('content') || meta.getAttribute('charset') || null,
        charset: meta.getAttribute('charset') || null,
        httpEquiv: meta.getAttribute('http-equiv') || null,
        property: meta.getAttribute('property') || null
      });
    });

    // Analyze link tags
    const linkTags = head.querySelectorAll('link');
    linkTags.forEach((link) => {
      analysis.linkTags.push({
        href: link.getAttribute('href') || null,
        rel: link.getAttribute('rel') || null,
        type: link.getAttribute('type') || null,
        as: link.getAttribute('as') || null
      });
    });

    return analysis;
  });

  const analysis = {
    title: headData.title,
    metaSummary: {
      important: [],
      all: []
    },
    linkSummary: []
  };

  // Process meta tags
  const importantMetaNames = ['description', 'viewport', 'charset'];
  headData.metaTags.forEach((meta) => {
    analysis.metaSummary.all.push(meta);

    // Check if it's an important meta tag
    if (meta.nameOrProperty && importantMetaNames.includes(meta.nameOrProperty.toLowerCase())) {
      analysis.metaSummary.important.push({
        ...meta,
        present: true
      });
    }
  });

  // Check for charset via meta charset or http-equiv
  const hasCharset = headData.metaTags.some(meta => 
    meta.charset || meta.httpEquiv === 'Content-Type'
  );
  if (!hasCharset) {
    analysis.metaSummary.important.push({
      nameOrProperty: 'charset',
      contentOrValue: null,
      present: false
    });
  }

  // Ensure all important meta tags are checked
  importantMetaNames.forEach((name) => {
    const found = analysis.metaSummary.important.find(
      (m) => m.nameOrProperty?.toLowerCase() === name.toLowerCase()
    );
    if (!found) {
      analysis.metaSummary.important.push({
        nameOrProperty: name,
        contentOrValue: null,
        present: false
      });
    }
  });

  // Analyze link tags with validation
  // Optimize: Skip validation for common CDN links and limit validation to first 30 links
  const commonCDNDomains = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 
                            'fonts.googleapis.com', 'fonts.gstatic.com', 'ajax.googleapis.com',
                            'cdn.jsdelivr.net', 'maxcdn.bootstrapcdn.com', 'cdn.jsdelivr.net'];
  
  const linkPromises = headData.linkTags.slice(0, 30).map(async (link) => {
    // Skip validation for CDN links - assume they're valid
    if (link.href) {
      try {
        const resolvedUrl = new URL(link.href, baseUrl);
        const linkHost = resolvedUrl.hostname;
        if (commonCDNDomains.some(cdn => linkHost.includes(cdn))) {
          return {
            ...link,
            status: 'valid',
            statusCode: 200,
            ok: true,
            sameOrigin: false,
            errorMessage: undefined
          };
        }
      } catch {
        // Continue with validation if URL parsing fails
      }
    }
    
    const validation = await validateLink(link.href, baseUrl);
    return {
      ...link,
      ...validation
    };
  });

  // For remaining links, mark as not validated
  const remainingLinks = headData.linkTags.slice(30).map(link => ({
    ...link,
    status: 'not_validated',
    statusCode: null,
    ok: null,
    sameOrigin: null,
    errorMessage: 'Skipped (too many links)'
  }));

  const validatedLinks = await Promise.all(linkPromises);
  analysis.linkSummary = [...validatedLinks, ...remainingLinks];

  return analysis;
};

/**
 * Tests interactive elements using Playwright
 * Optimized: All element tests run in parallel for maximum performance
 */
const testInteractiveElements = async (page, bodyAnalysis) => {
  // Test all element types in parallel
  const [buttonResults, inputResults, dropdownResults, checkboxResults] = await Promise.all([
    // Test all buttons in parallel
    Promise.all(
      bodyAnalysis.buttons.map(async (button) => {
        try {
          const { element, selector } = await findElementWithMultipleStrategies(page, button, 'button');

          if (element) {
            // Parallelize all property checks
            const [isVisible, isEnabled, boundingBox] = await Promise.all([
              element.isVisible().catch(() => false),
              element.isEnabled().catch(() => false),
              element.boundingBox().catch(() => null)
            ]);
            const isClickable = isVisible && isEnabled && boundingBox !== null;

            return {
              ...button,
              testResults: {
                clickable: isClickable,
                visible: isVisible,
                enabled: isEnabled,
                hasDimensions: boundingBox !== null,
                selector: selector,
                error: null
              }
            };
          } else {
            return {
              ...button,
              testResults: {
                clickable: false,
                visible: false,
                enabled: false,
                hasDimensions: false,
                selector: null,
                error: 'Element not found using any selector strategy'
              }
            };
          }
        } catch (error) {
          return {
            ...button,
            testResults: {
              clickable: false,
              visible: false,
              enabled: false,
              hasDimensions: false,
              selector: null,
              error: error.message
            }
          };
        }
      })
    ),

    // Test all inputs in parallel
    Promise.all(
      bodyAnalysis.inputs.map(async (input) => {
        try {
          const { element, selector } = await findElementWithMultipleStrategies(page, input, 'input');

          if (element) {
            // Parallelize all property checks
            const [isVisible, isEnabled, isReadOnly, isDisabled, boundingBox] = await Promise.all([
              element.isVisible().catch(() => false),
              element.isEnabled().catch(() => false),
              element.getAttribute('readonly').catch(() => null).then(val => val !== null),
              element.getAttribute('disabled').catch(() => null).then(val => val !== null),
              element.boundingBox().catch(() => null)
            ]);
            const isFillable = isVisible && isEnabled && !isReadOnly && !isDisabled && boundingBox !== null;

            // Try to fill with test text (only if fillable)
            let fillable = false;
            if (isFillable) {
              try {
                await element.fill('test', { timeout: 800 });
                fillable = true;
                await element.fill('').catch(() => {});
              } catch {
                fillable = false;
              }
            }

            return {
              ...input,
              testResults: {
                fillable: fillable,
                visible: isVisible,
                enabled: isEnabled,
                readonly: isReadOnly,
                disabled: isDisabled,
                hasDimensions: boundingBox !== null,
                selector: selector,
                error: null
              }
            };
          } else {
            return {
              ...input,
              testResults: {
                fillable: false,
                visible: false,
                enabled: false,
                readonly: false,
                disabled: false,
                hasDimensions: false,
                selector: null,
                error: 'Element not found using any selector strategy'
              }
            };
          }
        } catch (error) {
          return {
            ...input,
            testResults: {
              fillable: false,
              visible: false,
              enabled: false,
              readonly: false,
              disabled: false,
              hasDimensions: false,
              selector: null,
              error: error.message
            }
          };
        }
      })
    ),

    // Test all dropdowns in parallel
    Promise.all(
      bodyAnalysis.dropdowns.map(async (dropdown) => {
        try {
          const { element, selector } = await findElementWithMultipleStrategies(page, dropdown, 'select');

          if (element) {
            // Parallelize all property checks
            const [isVisible, isEnabled, boundingBox] = await Promise.all([
              element.isVisible().catch(() => false),
              element.isEnabled().catch(() => false),
              element.boundingBox().catch(() => null)
            ]);
            const isClickable = isVisible && isEnabled && boundingBox !== null;

            // Try to select an option
            let selectable = false;
            if (isClickable && dropdown.options && dropdown.options.length > 0) {
              try {
                const firstOptionValue = dropdown.options[0].value || dropdown.options[0].text;
                await element.selectOption(firstOptionValue, { timeout: 800 });
                selectable = true;
              } catch {
                selectable = false;
              }
            }

            return {
              ...dropdown,
              testResults: {
                clickable: isClickable,
                selectable: selectable,
                visible: isVisible,
                enabled: isEnabled,
                hasDimensions: boundingBox !== null,
                selector: selector,
                error: null
              }
            };
          } else {
            return {
              ...dropdown,
              testResults: {
                clickable: false,
                selectable: false,
                visible: false,
                enabled: false,
                hasDimensions: false,
                selector: null,
                error: 'Element not found using any selector strategy'
              }
            };
          }
        } catch (error) {
          return {
            ...dropdown,
            testResults: {
              clickable: false,
              selectable: false,
              visible: false,
              enabled: false,
              hasDimensions: false,
              selector: null,
              error: error.message
            }
          };
        }
      })
    ),

    // Test all checkboxes in parallel
    Promise.all(
      bodyAnalysis.checkboxes.map(async (checkbox) => {
        try {
          const { element, selector } = await findElementWithMultipleStrategies(page, checkbox, 'checkbox');

          if (element) {
            // Parallelize all property checks
            const [isVisible, isEnabled, boundingBox] = await Promise.all([
              element.isVisible().catch(() => false),
              element.isEnabled().catch(() => false),
              element.boundingBox().catch(() => null)
            ]);
            const isClickable = isVisible && isEnabled && boundingBox !== null;

            // Try to toggle checkbox
            let toggleable = false;
            if (isClickable) {
              try {
                const wasChecked = await element.isChecked().catch(() => false);
                await element.click({ timeout: 800 });
                const isNowChecked = await element.isChecked().catch(() => false);
                toggleable = wasChecked !== isNowChecked;
                if (toggleable) {
                  await element.click().catch(() => {});
                }
              } catch {
                toggleable = false;
              }
            }

            return {
              ...checkbox,
              testResults: {
                clickable: isClickable,
                toggleable: toggleable,
                visible: isVisible,
                enabled: isEnabled,
                hasDimensions: boundingBox !== null,
                selector: selector,
                error: null
              }
            };
          } else {
            return {
              ...checkbox,
              testResults: {
                clickable: false,
                toggleable: false,
                visible: false,
                enabled: false,
                hasDimensions: false,
                selector: null,
                error: 'Element not found using any selector strategy'
              }
            };
          }
        } catch (error) {
          return {
            ...checkbox,
            testResults: {
              clickable: false,
              toggleable: false,
              visible: false,
              enabled: false,
              hasDimensions: false,
              selector: null,
              error: error.message
            }
          };
        }
      })
    )
  ]);

  return {
    buttons: buttonResults,
    inputs: inputResults,
    dropdowns: dropdownResults,
    checkboxes: checkboxResults
  };
};

/**
 * Analyzes the BODY section of the document using Playwright
 */
const analyzeBody = async (page) => {
  const bodyData = await page.evaluate(() => {
    const body = document.body;
    const analysis = {
      buttons: [],
      dropdowns: [],
      inputs: [],
      checkboxes: []
    };

    // Analyze buttons
    const buttonElements = body.querySelectorAll('button');
    buttonElements.forEach((button) => {
      const text = button.textContent?.trim() || button.getAttribute('aria-label') || '';
      const dataAttrs = {};
      Array.from(button.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-')) {
          dataAttrs[attr.name] = attr.value;
        }
      });

      analysis.buttons.push({
        type: button.getAttribute('type') || 'button',
        text: text,
        id: button.getAttribute('id') || null,
        name: button.getAttribute('name') || null,
        class: button.getAttribute('class') || null,
        dataAttributes: Object.keys(dataAttrs).length > 0 ? dataAttrs : null
      });
    });

    // Analyze input buttons (type="button|submit|reset")
    const inputButtons = body.querySelectorAll('input[type="button"], input[type="submit"], input[type="reset"]');
    inputButtons.forEach((input) => {
      const inputId = input.getAttribute('id');
      const label = input.closest('label')?.textContent?.trim() ||
                    (inputId ? body.querySelector(`label[for="${inputId}"]`)?.textContent?.trim() : null) ||
                    input.getAttribute('aria-label') ||
                    input.getAttribute('value') ||
                    '';

      analysis.buttons.push({
        type: input.getAttribute('type'),
        text: label,
        id: inputId || null,
        name: input.getAttribute('name') || null,
        class: input.getAttribute('class') || null,
        dataAttributes: null
      });
    });

    // Analyze dropdowns (select elements)
    const selectElements = body.querySelectorAll('select');
    selectElements.forEach((select) => {
      const options = Array.from(select.querySelectorAll('option')).map((option) => ({
        value: option.getAttribute('value') || option.textContent?.trim() || '',
        text: option.textContent?.trim() || '',
        selected: option.selected || option.hasAttribute('selected')
      }));

      analysis.dropdowns.push({
        id: select.getAttribute('id') || null,
        name: select.getAttribute('name') || null,
        multiple: select.hasAttribute('multiple'),
        options: options
      });
    });

    // Analyze inputs (excluding checkboxes, radio, and button types)
    const inputElements = body.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])');
    inputElements.forEach((input) => {
      const ariaAttrs = {};
      Array.from(input.attributes).forEach((attr) => {
        if (attr.name.startsWith('aria-')) {
          ariaAttrs[attr.name] = attr.value;
        }
      });

      analysis.inputs.push({
        type: input.getAttribute('type') || 'text',
        name: input.getAttribute('name') || null,
        id: input.getAttribute('id') || null,
        placeholder: input.getAttribute('placeholder') || null,
        required: input.hasAttribute('required'),
        ariaAttributes: Object.keys(ariaAttrs).length > 0 ? ariaAttrs : null
      });
    });

    // Analyze checkboxes
    const checkboxElements = body.querySelectorAll('input[type="checkbox"]');
    checkboxElements.forEach((checkbox) => {
      const checkboxId = checkbox.getAttribute('id');
      let labelText = null;

      // Try to find associated label
      if (checkboxId) {
        const label = body.querySelector(`label[for="${checkboxId}"]`);
        if (label) {
          labelText = label.textContent?.trim() || null;
        }
      }

      // If no label found, check if checkbox is wrapped in a label
      if (!labelText) {
        const parentLabel = checkbox.closest('label');
        if (parentLabel) {
          labelText = parentLabel.textContent?.trim() || null;
        }
      }

      analysis.checkboxes.push({
        id: checkboxId || null,
        name: checkbox.getAttribute('name') || null,
        checked: checkbox.checked || checkbox.hasAttribute('checked'),
        labelText: labelText
      });
    });

    return analysis;
  });

  return bodyData;
};

/**
 * Helper function to send SSE message
 */
const sendSSE = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Stream-based controller function with progressive loading
 */
export const analyzeUrlStream = async (req, res) => {
  let browser = null;
  let context = null;
  let page = null;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const { url } = req.query;

    if (!url) {
      sendSSE(res, 'error', { error: 'Missing url query parameter' });
      res.end();
      return;
    }

    // Validate URL format
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch {
      sendSSE(res, 'error', { error: 'Invalid URL format' });
      res.end();
      return;
    }

    sendSSE(res, 'status', { message: 'Initializing browser...' });

    try {
      console.log(`🔍 Analyzing DOM for: ${url}`);

      // Launch browser
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

      // Block unnecessary resources
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Collect console errors and warnings
      const consoleErrors = [];
      const consoleWarnings = [];
      page.on("console", (msg) => {
        const msgType = msg.type();
        if (msgType === "error") {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        } else if (msgType === "warning") {
          consoleWarnings.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      });

      // Collect network errors
      const networkErrors = [];
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

      sendSSE(res, 'status', { message: 'Navigating to page...' });
      console.log(`🔍 Navigating to: ${url}`);
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Verify page has loaded
      const hasHead = await page.evaluate(() => !!document.head);
      const hasBody = await page.evaluate(() => !!document.body);

      if (!hasHead || !hasBody) {
        await browser.close();
        sendSSE(res, 'error', { error: 'Invalid HTML structure - missing head or body' });
        res.end();
        return;
      }

      // Send console and network errors immediately (already collected in parallel via event listeners)
      // Send them in parallel for better performance
      const consoleData = {
        errors: consoleErrors,
        warnings: consoleWarnings
      };
      sendSSE(res, 'console', { consoleData });
      sendSSE(res, 'network', { networkErrors });

      // Analyze HEAD first and send immediately
      sendSSE(res, 'status', { message: 'Analyzing HEAD section...' });
      const headAnalysis = await analyzeHead(page, url);
      sendSSE(res, 'head', { headAnalysis });

      // Analyze BODY structure
      sendSSE(res, 'status', { message: 'Analyzing BODY section...' });
      const bodyAnalysis = await analyzeBody(page);

      // Test interactive elements and send progressively
      sendSSE(res, 'status', { message: 'Testing interactive elements...' });
      const testResults = await testInteractiveElements(page, bodyAnalysis);

      // Merge and send body analysis with tests
      const bodyAnalysisWithTests = {
        buttons: testResults.buttons,
        dropdowns: testResults.dropdowns,
        inputs: testResults.inputs,
        checkboxes: testResults.checkboxes
      };
      
      sendSSE(res, 'body', { bodyAnalysis: bodyAnalysisWithTests });

      sendSSE(res, 'complete', { url });

      await browser.close();
      browser = null;

    } catch (error) {
      console.error('❌ Failed to fetch URL with Playwright:', url, error.message);
      
      if (browser) {
        await browser.close().catch(() => {});
      }

      let errorDetails = error.message;
      if (error.message.includes('net::ERR_CONNECTION_REFUSED') || error.message.includes('Navigation timeout')) {
        errorDetails = 'Connection refused or timeout. Make sure the URL is accessible from the server.';
      } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        errorDetails = 'Host not found. Check if the URL is correct.';
      }
      
      sendSSE(res, 'error', { error: 'Failed to fetch URL', details: errorDetails });
    }

    res.end();

  } catch (error) {
    console.error('❌ AnalyzeUrlStream Error:', error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    sendSSE(res, 'error', { error: 'Failed to analyze URL', details: error.message });
    res.end();
  }
};

/**
 * Main controller function (kept for backward compatibility)
 */
export const analyzeUrl = async (req, res) => {
  let browser = null;
  let context = null;
  let page = null;

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    // Validate URL format
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Use Playwright to get fully rendered DOM (with JavaScript executed)
    let headAnalysis;
    let bodyAnalysisWithTests;
    
    try {
      console.log(`🔍 Analyzing DOM for: ${url}`);

      // Launch browser with performance optimizations
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
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        // Block images, fonts, and media - we only need HTML, CSS, and JS for DOM analysis
        if (['image', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Navigate to URL with faster wait strategy
      // 'domcontentloaded' is faster than 'networkidle' and sufficient for DOM analysis
      console.log(`🔍 Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000 // Reduced from 5 minutes to 1 minute
      });

      // Wait for critical content to render (reduced from 3s to 1s)
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // If networkidle times out, continue anyway - DOM is already loaded
      });
      await page.waitForTimeout(1000);

      // Verify page has loaded correctly
      const hasHead = await page.evaluate(() => !!document.head);
      const hasBody = await page.evaluate(() => !!document.body);

      if (!hasHead || !hasBody) {
        await browser.close();
        return res.status(500).json({
          error: 'Invalid HTML structure - missing head or body'
        });
      }

      // Analyze HEAD and BODY structure in parallel (they're independent)
      const [headAnalysisResult, bodyAnalysis] = await Promise.all([
        analyzeHead(page, url),
        analyzeBody(page)
      ]);
      headAnalysis = headAnalysisResult;

      // Test interactive elements using Playwright (page is still open)
      const testResults = await testInteractiveElements(page, bodyAnalysis);

      // Merge test results with body analysis
      bodyAnalysisWithTests = {
        buttons: testResults.buttons,
        dropdowns: testResults.dropdowns,
        inputs: testResults.inputs,
        checkboxes: testResults.checkboxes
      };

      await browser.close();
      browser = null;
    } catch (error) {
      console.error('❌ Failed to fetch URL with Playwright:', url, error.message);
      
      if (browser) {
        await browser.close().catch(() => {});
      }

      // Provide more specific error messages
      let errorDetails = error.message;
      if (error.message.includes('net::ERR_CONNECTION_REFUSED') || error.message.includes('Navigation timeout')) {
        errorDetails = 'Connection refused or timeout. Make sure the URL is accessible from the server.';
      } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        errorDetails = 'Host not found. Check if the URL is correct.';
      }
      
      return res.status(500).json({
        error: 'Failed to fetch URL',
        details: errorDetails
      });
    }

    // Return the analysis
    return res.status(200).json({
      url,
      headAnalysis,
      bodyAnalysis: bodyAnalysisWithTests
    });
  } catch (error) {
    console.error('❌ AnalyzeUrl Error:', error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    return res.status(500).json({
      error: 'Failed to analyze URL',
      details: error.message
    });
  }
};


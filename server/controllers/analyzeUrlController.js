import axios from 'axios';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';

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
 * Analyzes the HEAD section of the document
 */
const analyzeHead = async (head, baseUrl) => {
  const analysis = {
    title: {
      hasTitle: false,
      titleText: null
    },
    metaSummary: {
      important: [],
      all: []
    },
    linkSummary: []
  };

  // Analyze title
  const titleElement = head.querySelector('title');
  if (titleElement) {
    analysis.title.hasTitle = true;
    analysis.title.titleText = titleElement.textContent?.trim() || null;
  }

  // Analyze meta tags
  const importantMetaNames = ['description', 'viewport', 'charset'];
  const metaTags = head.querySelectorAll('meta');

  metaTags.forEach((meta) => {
    const metaInfo = {
      nameOrProperty: meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv') || null,
      contentOrValue: meta.getAttribute('content') || meta.getAttribute('charset') || null,
      charset: meta.getAttribute('charset') || null,
      httpEquiv: meta.getAttribute('http-equiv') || null,
      property: meta.getAttribute('property') || null
    };

    analysis.metaSummary.all.push(metaInfo);

    // Check if it's an important meta tag
    if (metaInfo.nameOrProperty && importantMetaNames.includes(metaInfo.nameOrProperty.toLowerCase())) {
      analysis.metaSummary.important.push({
        ...metaInfo,
        present: true
      });
    }
  });

  // Check for charset via meta charset or http-equiv
  const charsetMeta = head.querySelector('meta[charset]') || head.querySelector('meta[http-equiv="Content-Type"]');
  if (!charsetMeta) {
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

  // Analyze link tags
  const linkTags = head.querySelectorAll('link');
  const linkPromises = Array.from(linkTags).map(async (link) => {
    const href = link.getAttribute('href');
    const validation = await validateLink(href, baseUrl);

    return {
      href: href || null,
      rel: link.getAttribute('rel') || null,
      type: link.getAttribute('type') || null,
      as: link.getAttribute('as') || null,
      ...validation
    };
  });

  analysis.linkSummary = await Promise.all(linkPromises);

  return analysis;
};

/**
 * Tests interactive elements using Playwright
 */
const testInteractiveElements = async (page, bodyAnalysis) => {
  const testResults = {
    buttons: [],
    dropdowns: [],
    inputs: [],
    checkboxes: []
  };

  // Test buttons
  for (const button of bodyAnalysis.buttons) {
    try {
      let selector = null;
      if (button.id) {
        selector = `#${button.id.replace(/[#.]/g, '\\$&')}`;
      } else if (button.name) {
        selector = `button[name="${button.name}"], input[type="button"][name="${button.name}"], input[type="submit"][name="${button.name}"], input[type="reset"][name="${button.name}"]`;
      }

      if (selector) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          const isEnabled = await element.isEnabled().catch(() => false);
          const boundingBox = await element.boundingBox().catch(() => null);
          const isClickable = isVisible && isEnabled && boundingBox !== null;

          testResults.buttons.push({
            ...button,
            testResults: {
              clickable: isClickable,
              visible: isVisible,
              enabled: isEnabled,
              hasDimensions: boundingBox !== null,
              error: null
            }
          });
        } else {
          testResults.buttons.push({
            ...button,
            testResults: {
              clickable: false,
              visible: false,
              enabled: false,
              hasDimensions: false,
              error: 'Element not found in DOM'
            }
          });
        }
      } else {
        testResults.buttons.push({
          ...button,
          testResults: {
            clickable: false,
            visible: false,
            enabled: false,
            hasDimensions: false,
            error: 'No selector available (missing id or name)'
          }
        });
      }
    } catch (error) {
      testResults.buttons.push({
        ...button,
        testResults: {
          clickable: false,
          visible: false,
          enabled: false,
          hasDimensions: false,
          error: error.message
        }
      });
    }
  }

  // Test inputs
  for (const input of bodyAnalysis.inputs) {
    try {
      let selector = null;
      if (input.id) {
        selector = `#${input.id.replace(/[#.]/g, '\\$&')}`;
      } else if (input.name) {
        selector = `input[name="${input.name}"]:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])`;
      }

      if (selector) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          const isEnabled = await element.isEnabled().catch(() => false);
          const isReadOnly = await element.getAttribute('readonly').catch(() => null) !== null;
          const isDisabled = await element.getAttribute('disabled').catch(() => null) !== null;
          const boundingBox = await element.boundingBox().catch(() => null);
          const isFillable = isVisible && isEnabled && !isReadOnly && !isDisabled && boundingBox !== null;

          // Try to fill with test text
          let fillable = false;
          if (isFillable) {
            try {
              await element.fill('test', { timeout: 1000 });
              fillable = true;
              // Clear the test text
              await element.fill('').catch(() => {});
            } catch {
              fillable = false;
            }
          }

          testResults.inputs.push({
            ...input,
            testResults: {
              fillable: fillable,
              visible: isVisible,
              enabled: isEnabled,
              readonly: isReadOnly,
              disabled: isDisabled,
              hasDimensions: boundingBox !== null,
              error: null
            }
          });
        } else {
          testResults.inputs.push({
            ...input,
            testResults: {
              fillable: false,
              visible: false,
              enabled: false,
              readonly: false,
              disabled: false,
              hasDimensions: false,
              error: 'Element not found in DOM'
            }
          });
        }
      } else {
        testResults.inputs.push({
          ...input,
          testResults: {
            fillable: false,
            visible: false,
            enabled: false,
            readonly: false,
            disabled: false,
            hasDimensions: false,
            error: 'No selector available (missing id or name)'
          }
        });
      }
    } catch (error) {
      testResults.inputs.push({
        ...input,
        testResults: {
          fillable: false,
          visible: false,
          enabled: false,
          readonly: false,
          disabled: false,
          hasDimensions: false,
          error: error.message
        }
      });
    }
  }

  // Test dropdowns
  for (const dropdown of bodyAnalysis.dropdowns) {
    try {
      let selector = null;
      if (dropdown.id) {
        selector = `#${dropdown.id.replace(/[#.]/g, '\\$&')}`;
      } else if (dropdown.name) {
        selector = `select[name="${dropdown.name}"]`;
      }

      if (selector) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          const isEnabled = await element.isEnabled().catch(() => false);
          const boundingBox = await element.boundingBox().catch(() => null);
          const isClickable = isVisible && isEnabled && boundingBox !== null;

          // Try to select an option
          let selectable = false;
          if (isClickable && dropdown.options && dropdown.options.length > 0) {
            try {
              const firstOptionValue = dropdown.options[0].value || dropdown.options[0].text;
              await element.selectOption(firstOptionValue, { timeout: 1000 });
              selectable = true;
            } catch {
              selectable = false;
            }
          }

          testResults.dropdowns.push({
            ...dropdown,
            testResults: {
              clickable: isClickable,
              selectable: selectable,
              visible: isVisible,
              enabled: isEnabled,
              hasDimensions: boundingBox !== null,
              error: null
            }
          });
        } else {
          testResults.dropdowns.push({
            ...dropdown,
            testResults: {
              clickable: false,
              selectable: false,
              visible: false,
              enabled: false,
              hasDimensions: false,
              error: 'Element not found in DOM'
            }
          });
        }
      } else {
        testResults.dropdowns.push({
          ...dropdown,
          testResults: {
            clickable: false,
            selectable: false,
            visible: false,
            enabled: false,
            hasDimensions: false,
            error: 'No selector available (missing id or name)'
          }
        });
      }
    } catch (error) {
      testResults.dropdowns.push({
        ...dropdown,
        testResults: {
          clickable: false,
          selectable: false,
          visible: false,
          enabled: false,
          hasDimensions: false,
          error: error.message
        }
      });
    }
  }

  // Test checkboxes
  for (const checkbox of bodyAnalysis.checkboxes) {
    try {
      let selector = null;
      if (checkbox.id) {
        selector = `#${checkbox.id.replace(/[#.]/g, '\\$&')}`;
      } else if (checkbox.name) {
        selector = `input[type="checkbox"][name="${checkbox.name}"]`;
      }

      if (selector) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          const isEnabled = await element.isEnabled().catch(() => false);
          const boundingBox = await element.boundingBox().catch(() => null);
          const isClickable = isVisible && isEnabled && boundingBox !== null;

          // Try to toggle checkbox
          let toggleable = false;
          if (isClickable) {
            try {
              const wasChecked = await element.isChecked().catch(() => false);
              await element.click({ timeout: 1000 });
              const isNowChecked = await element.isChecked().catch(() => false);
              toggleable = wasChecked !== isNowChecked;
              // Toggle back if it changed
              if (toggleable) {
                await element.click().catch(() => {});
              }
            } catch {
              toggleable = false;
            }
          }

          testResults.checkboxes.push({
            ...checkbox,
            testResults: {
              clickable: isClickable,
              toggleable: toggleable,
              visible: isVisible,
              enabled: isEnabled,
              hasDimensions: boundingBox !== null,
              error: null
            }
          });
        } else {
          testResults.checkboxes.push({
            ...checkbox,
            testResults: {
              clickable: false,
              toggleable: false,
              visible: false,
              enabled: false,
              hasDimensions: false,
              error: 'Element not found in DOM'
            }
          });
        }
      } else {
        testResults.checkboxes.push({
          ...checkbox,
          testResults: {
            clickable: false,
            toggleable: false,
            visible: false,
            enabled: false,
            hasDimensions: false,
            error: 'No selector available (missing id or name)'
          }
        });
      }
    } catch (error) {
      testResults.checkboxes.push({
        ...checkbox,
        testResults: {
          clickable: false,
          toggleable: false,
          visible: false,
          enabled: false,
          hasDimensions: false,
          error: error.message
        }
      });
    }
  }

  return testResults;
};

/**
 * Analyzes the BODY section of the document
 */
const analyzeBody = (body) => {
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
    const label = input.closest('label')?.textContent?.trim() ||
                  body.querySelector(`label[for="${input.getAttribute('id')}"]`)?.textContent?.trim() ||
                  input.getAttribute('aria-label') ||
                  input.getAttribute('value') ||
                  '';

    analysis.buttons.push({
      type: input.getAttribute('type'),
      text: label,
      id: input.getAttribute('id') || null,
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
};

/**
 * Main controller function
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

      // Launch browser
      browser = await chromium.launch({ headless: true });

      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true
      });

      page = await context.newPage();

      // Navigate to URL and wait for content to load
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // Wait for client-side JavaScript to render
      await page.waitForTimeout(3000);

      // Get the fully rendered HTML
      const html = await page.content();

      // Analyze HEAD and BODY from HTML
      const dom = new JSDOM(html, {
        url: url,
        contentType: 'text/html',
        runScripts: 'outside-only'
      });

      const document = dom.window.document;
      const head = document.head;
      const body = document.body;

      if (!head || !body) {
        await browser.close();
        return res.status(500).json({
          error: 'Invalid HTML structure - missing head or body'
        });
      }

      // Analyze HEAD and BODY structure
      headAnalysis = await analyzeHead(head, url);
      const bodyAnalysis = analyzeBody(body);

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


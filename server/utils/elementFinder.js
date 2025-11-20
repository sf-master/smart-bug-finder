/**
 * Escapes CSS selector special characters
 */
export const escapeCSSSelector = (str) => {
  return str.replace(/[#.]/g, '\\$&');
};

/**
 * Finds an element using multiple selector strategies
 */
export const findElementWithMultipleStrategies = async (page, elementInfo, elementType) => {
  let element = null;
  let usedSelector = null;

  // Strategy 1: Try ID selector
  if (elementInfo.id) {
    try {
      const idSelector = `#${escapeCSSSelector(elementInfo.id)}`;
      element = await page.$(idSelector).catch(() => null);
      if (element) {
        usedSelector = `#${elementInfo.id}`;
        return { element, selector: usedSelector };
      }
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 2: Try name attribute
  if (elementInfo.name) {
    try {
      let nameSelector = '';
      if (elementType === 'button') {
        nameSelector = `button[name="${elementInfo.name}"], input[type="button"][name="${elementInfo.name}"], input[type="submit"][name="${elementInfo.name}"], input[type="reset"][name="${elementInfo.name}"]`;
      } else if (elementType === 'input') {
        nameSelector = `input[name="${elementInfo.name}"]:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])`;
      } else if (elementType === 'select') {
        nameSelector = `select[name="${elementInfo.name}"]`;
      } else if (elementType === 'checkbox') {
        nameSelector = `input[type="checkbox"][name="${elementInfo.name}"]`;
      }
      
      if (nameSelector) {
        element = await page.$(nameSelector).catch(() => null);
        if (element) {
          usedSelector = `[name="${elementInfo.name}"]`;
          return { element, selector: usedSelector };
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Try text content matching (for buttons)
  if (elementType === 'button' && elementInfo.text) {
    const text = elementInfo.text.trim();
    if (text && text.length > 0 && text.length < 200) {
      try {
        // Use Playwright's getByText or getByRole
        const locator = page.getByText(text, { exact: false }).first();
        element = await locator.elementHandle().catch(() => null);
        if (element) {
          usedSelector = `text: "${text.substring(0, 50)}"`;
          return { element, selector: usedSelector };
        }
      } catch (e) {
        // Try getByRole for buttons
        try {
          const locator = page.getByRole('button', { name: text, exact: false }).first();
          element = await locator.elementHandle().catch(() => null);
          if (element) {
            usedSelector = `role=button, name="${text.substring(0, 50)}"`;
            return { element, selector: usedSelector };
          }
        } catch (e2) {
          // Ignore
        }
      }
    }
  }

  // Strategy 4: Try placeholder for inputs
  if (elementType === 'input' && elementInfo.placeholder) {
    try {
      const escapedPlaceholder = elementInfo.placeholder.replace(/"/g, '\\"');
      const placeholderSelector = `input[placeholder="${escapedPlaceholder}"]:not([type="checkbox"]):not([type="radio"])`;
      element = await page.$(placeholderSelector).catch(() => null);
      if (element) {
        usedSelector = `[placeholder="${elementInfo.placeholder.substring(0, 50)}"]`;
        return { element, selector: usedSelector };
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 5: Try data attributes
  if (elementInfo.dataAttributes) {
    for (const [key, value] of Object.entries(elementInfo.dataAttributes)) {
      try {
        const escapedValue = String(value).replace(/"/g, '\\"');
        const dataSelector = `[${key}="${escapedValue}"]`;
        if (elementType === 'button') {
          element = await page.$(`button${dataSelector}, input[type="button"]${dataSelector}, input[type="submit"]${dataSelector}, input[type="reset"]${dataSelector}`).catch(() => null);
        } else if (elementType === 'input') {
          element = await page.$(`input${dataSelector}:not([type="checkbox"]):not([type="radio"])`).catch(() => null);
        } else if (elementType === 'select') {
          element = await page.$(`select${dataSelector}`).catch(() => null);
        } else if (elementType === 'checkbox') {
          element = await page.$(`input[type="checkbox"]${dataSelector}`).catch(() => null);
        }
        
        if (element) {
          usedSelector = `[${key}="${value.substring(0, 50)}"]`;
          return { element, selector: usedSelector };
        }
      } catch (e) {
        // Continue to next data attribute
      }
    }
  }

  // Strategy 6: Try class name (if available)
  if (elementInfo.class) {
    const classes = elementInfo.class.split(/\s+/).filter(c => c.length > 0);
    if (classes.length > 0) {
      try {
        // Try first class
        const classSelector = `.${escapeCSSSelector(classes[0])}`;
        if (elementType === 'button') {
          element = await page.$(`button${classSelector}, input[type="button"]${classSelector}, input[type="submit"]${classSelector}, input[type="reset"]${classSelector}`).catch(() => null);
        } else if (elementType === 'input') {
          element = await page.$(`input${classSelector}:not([type="checkbox"]):not([type="radio"])`).catch(() => null);
        } else if (elementType === 'select') {
          element = await page.$(`select${classSelector}`).catch(() => null);
        } else if (elementType === 'checkbox') {
          element = await page.$(`input[type="checkbox"]${classSelector}`).catch(() => null);
        }
        
        if (element) {
          usedSelector = `.${classes[0]}`;
          return { element, selector: usedSelector };
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Strategy 7: Try label text for inputs/checkboxes
  if ((elementType === 'input' || elementType === 'checkbox') && elementInfo.labelText) {
    try {
      const labelText = elementInfo.labelText.trim();
      if (labelText && labelText.length < 200) {
        // Find label by text, then get associated input
        const labelLocator = page.getByText(labelText, { exact: false }).first();
        const labelElement = await labelLocator.elementHandle().catch(() => null);
        if (labelElement) {
          // Check if it's a label element
          const tagName = await labelElement.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
          if (tagName === 'label') {
            // Get the 'for' attribute or find input inside
            const forAttr = await labelElement.getAttribute('for').catch(() => null);
            if (forAttr) {
              const inputElement = await page.$(`#${escapeCSSSelector(forAttr)}`).catch(() => null);
              if (inputElement) {
                usedSelector = `label[for="${forAttr}"]`;
                return { element: inputElement, selector: usedSelector };
              }
            } else {
              // Input might be inside the label
              const inputInside = await labelElement.$('input').catch(() => null);
              if (inputInside) {
                usedSelector = `label:has-text("${labelText.substring(0, 50)}") > input`;
                return { element: inputInside, selector: usedSelector };
              }
            }
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 8: Try type and position-based selector (last resort)
  // Get all elements of this type and try to match by index/position
  try {
    let allElements = [];
    if (elementType === 'button') {
      allElements = await page.$$('button, input[type="button"], input[type="submit"], input[type="reset"]').catch(() => []);
    } else if (elementType === 'input') {
      allElements = await page.$$('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])').catch(() => []);
    } else if (elementType === 'select') {
      allElements = await page.$$('select').catch(() => []);
    } else if (elementType === 'checkbox') {
      allElements = await page.$$('input[type="checkbox"]').catch(() => []);
    }

    // Try to match by text content if available
    if (allElements.length > 0) {
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        try {
          // For buttons, check text content
          if (elementType === 'button' && elementInfo.text) {
            const text = await el.textContent().catch(() => '');
            if (text && text.trim() === elementInfo.text.trim()) {
              usedSelector = `${elementType}[${i}] (matched by text)`;
              return { element: el, selector: usedSelector };
            }
          }
          // For inputs, check placeholder
          if (elementType === 'input' && elementInfo.placeholder) {
            const placeholder = await el.getAttribute('placeholder').catch(() => '');
            if (placeholder === elementInfo.placeholder) {
              usedSelector = `${elementType}[${i}] (matched by placeholder)`;
              return { element: el, selector: usedSelector };
            }
          }
        } catch (e) {
          // Continue to next element
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  return { element: null, selector: null };
};


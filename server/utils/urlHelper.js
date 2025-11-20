import fetch from "node-fetch";

/**
 * Checks if a URL is valid & accessible.
 * Returns: { ok: boolean, status: number, error?: string }
 */
export const checkUrlAccessible = async (url) => {
  try {
    // Validate URL format first
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (err) {
      return { ok: false, status: 0, error: "Invalid URL format" };
    }

    // Quick HEAD request (faster than GET)
    const response = await fetch(parsedUrl.toString(), {
      method: "HEAD",
      redirect: "follow",
      timeout: 8000,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `URL returned non-200 status: ${response.status}`,
      };
    }

    return { ok: true, status: response.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message || "Unknown error while checking URL",
    };
  }
};

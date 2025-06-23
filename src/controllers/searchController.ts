import { Request, Response } from "express";
import { createBrowserManager } from "../utils/browserManager.js";
import { Page } from "playwright";
import * as fs from "fs/promises";

const browserManager = createBrowserManager();

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

const getRandomUserAgent = (): string => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

const waitForResults = async (page: Page, maxRetries = 3): Promise<boolean> => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await Promise.race([
        page.waitForSelector("li.b_algo h2 a", {
          timeout: 15000,
          state: "visible",
        }), // Bing
        page.waitForSelector(".algo-sr a", {
          timeout: 15000,
          state: "visible",
        }), // Yahoo
        page.waitForSelector('div.MjjYud a[jsname="UWckNb"]', {
          timeout: 15000,
          state: "visible",
        }), // Google
        page.waitForSelector("article h2 a .EKtkFWMYpwzMKOYr0GYm", {
          timeout: 15000,
          state: "visible",
        }), // DuckDuckGo
        page.waitForSelector("#captcha-form", { timeout: 15000 }),
        page.waitForSelector(".rc-anchor-content", { timeout: 15000 }), // reCAPTCHA
      ]);

      const captcha = await page.$$("#captcha-form, .rc-anchor-content");
      if (captcha.length > 0) {
        console.warn(`Retry ${retries + 1}/${maxRetries}: CAPTCHA detected`);
        retries++;
        if (retries === maxRetries) return false;
        await page.waitForTimeout(5000 + Math.random() * 3000);
        await page.reload({ waitUntil: "networkidle" });
        continue;
      }

      const hasBingResults = await page
        .$$("li.b_algo h2 a")
        .then((els) => els.length > 0);
      const hasYahooResults = await page
        .$$(".algo-sr a")
        .then((els) => els.length > 0);
      const hasGoogleResults = await page
        .$$('div.MjjYud a[jsname="UWckNb"]')
        .then((els) => els.length > 0);
      const hasDuckDuckGoResults = await page
        .$$("article h2 a .EKtkFWMYpwzMKOYr0GYm")
        .then((els) => els.length > 0);

      return (
        hasBingResults ||
        hasYahooResults ||
        hasGoogleResults ||
        hasDuckDuckGoResults
      );
    } catch (error) {
      console.warn(
        `Retry ${retries + 1}/${maxRetries}: ${(error as Error).message}`
      );
      retries++;
      if (retries === maxRetries) {
        await page.screenshot({ path: `debug_retry_${retries}.png` });
        await fs.writeFile(`debug_retry_${retries}.html`, await page.content());
        return false;
      }
      await page.waitForTimeout(5000 + Math.random() * 3000);
      await page.reload({ waitUntil: "networkidle" });
    }
  }
  return false;
};

const performGoogleSearch = async (
  page: Page,
  query: string
): Promise<SearchResult[]> => {
  await page.context().setExtraHTTPHeaders({
    "User-Agent": getRandomUserAgent(),
  });

  await page.goto("https://www.google.com", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000 + Math.random() * 2000);

  try {
    await page.waitForSelector("textarea[name='q']", { timeout: 10000 });
  } catch (error) {
    await page.screenshot({ path: "debug_timeout.png" });
    await fs.writeFile("debug_timeout.html", await page.content());
    throw new Error("Search textarea not found on page");
  }

  await page.type("textarea[name='q']", query, {
    delay: 100 + Math.random() * 50,
  });
  await page.keyboard.press("Enter");

  await page.waitForNavigation({ waitUntil: "networkidle" });

  const resultsLoaded = await waitForResults(page);
  if (!resultsLoaded) {
    throw new Error("CAPTCHA or load failure after retries");
  }

  const searchResults = await page.evaluate(() => {
    const results: SearchResult[] = [];
    const elements = document.querySelectorAll('div.MjjYud a[jsname="UWckNb"]');

    for (let i = 0; i < Math.min(3, elements.length); i++) {
      const element = elements[i] as HTMLAnchorElement;
      const titleElement = element.querySelector("h3");
      const descriptionElement = element
        .closest("div.MjjYud")
        ?.querySelector("div[data-sncf='1'] span:last-child");

      const url = element.getAttribute("href") || "";
      if (titleElement && url) {
        results.push({
          title: titleElement.textContent?.trim() || "",
          url,
          description: descriptionElement?.textContent?.trim() || "",
        });
      }
    }
    return results;
  });

  return searchResults;
};

const searchDuckDuckGo = async (
  page: Page,
  query: string
): Promise<SearchResult[]> => {
  await page.context().setExtraHTTPHeaders({
    "User-Agent": getRandomUserAgent(),
  });

  await page.goto("https://duckduckgo.com", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000 + Math.random() * 2000);

  try {
    await page.waitForSelector("input[name='q']", { timeout: 10000 });
  } catch (error) {
    await page.screenshot({ path: "debug_duckduckgo_timeout.png" });
    await fs.writeFile("debug_duckduckgo_timeout.html", await page.content());
    throw new Error("Search input not found on DuckDuckGo");
  }

  await page.type("input[name='q']", query, {
    delay: 100 + Math.random() * 50,
  });
  await page.keyboard.press("Enter");

  await page.waitForNavigation({ waitUntil: "networkidle" });

  try {
    await page.waitForSelector("article h2 a .EKtkFWMYpwzMKOYr0GYm", {
      timeout: 15000,
      state: "visible",
    });
  } catch (error) {
    await page.screenshot({ path: "debug_duckduckgo_result_timeout.png" });
    await fs.writeFile(
      "debug_duckduckgo_result_timeout.html",
      await page.content()
    );
    throw new Error("Result titles not found on DuckDuckGo");
  }

  const searchResults = await page.evaluate(() => {
    const results: SearchResult[] = [];
    const elements = document.querySelectorAll("article h2 a");

    for (let i = 0; i < Math.min(3, elements.length); i++) {
      const link = elements[i] as HTMLAnchorElement;
      const titleElement = link.querySelector(".EKtkFWMYpwzMKOYr0GYm");
      const url = link.getAttribute("href") || "";
      const descriptionElement = link
        .closest("article")
        ?.querySelector(".OgdwYG6KE2qthn9XQWFC");

      if (titleElement && url) {
        results.push({
          title: titleElement.textContent?.trim() || "",
          url: url.startsWith("/") ? `https://duckduckgo.com${url}` : url,
          description: descriptionElement?.textContent?.trim() || "",
        });
      }
    }
    return results;
  });

  return searchResults;
};

const searchBing = async (
  page: Page,
  query: string
): Promise<SearchResult[]> => {
  await page.context().setExtraHTTPHeaders({
    "User-Agent": getRandomUserAgent(),
  });

  await page.goto("https://www.bing.com", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000 + Math.random() * 2000);

  try {
    await page.waitForSelector("input[name='q']", { timeout: 10000 });
  } catch (error) {
    await page.screenshot({ path: "debug_bing_timeout.png" });
    await fs.writeFile("debug_bing_timeout.html", await page.content());
    throw new Error("Search input not found on Bing");
  }

  await page.type("input[name='q']", query, {
    delay: 100 + Math.random() * 50,
  });
  await page.keyboard.press("Enter");

  await page.waitForNavigation({ waitUntil: "networkidle" });

  try {
    await page.waitForSelector("li.b_algo h2 a", {
      timeout: 15000,
      state: "visible",
    });
  } catch (error) {
    await page.screenshot({ path: "debug_bing_result_timeout.png" });
    await fs.writeFile("debug_bing_result_timeout.html", await page.content());
    throw new Error("Result links not found on Bing");
  }

  const searchResults = await page.evaluate(() => {
    const results: SearchResult[] = [];
    const elements = document.querySelectorAll("li.b_algo h2 a");

    for (let i = 0; i < Math.min(3, elements.length); i++) {
      const link = elements[i] as HTMLAnchorElement;
      const url = link.getAttribute("href") || "";
      const descriptionElement = link
        .closest("li.b_algo")
        ?.querySelector(".b_caption p");

      results.push({
        title: link.textContent?.trim() || "",
        url,
        description: descriptionElement?.textContent?.trim() || "",
      });
    }
    return results;
  });

  return searchResults;
};

const searchYahoo = async (
  page: Page,
  query: string
): Promise<SearchResult[]> => {
  await page.context().setExtraHTTPHeaders({
    "User-Agent": getRandomUserAgent(),
  });

  await page.goto("https://search.yahoo.com", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000 + Math.random() * 2000);

  try {
    await page.waitForSelector("input[name='p']", { timeout: 10000 }); // Yahoo uses 'p' for search
  } catch (error) {
    await page.screenshot({ path: "debug_yahoo_timeout.png" });
    await fs.writeFile("debug_yahoo_timeout.html", await page.content());
    throw new Error("Search input not found on Yahoo");
  }

  await page.type("input[name='p']", query, {
    delay: 100 + Math.random() * 50,
  });
  await page.keyboard.press("Enter");

  await page.waitForNavigation({ waitUntil: "networkidle" });

  try {
    await page.waitForSelector(".algo-sr a", {
      timeout: 15000,
      state: "visible",
    });
  } catch (error) {
    await page.screenshot({ path: "debug_yahoo_result_timeout.png" });
    await fs.writeFile("debug_yahoo_result_timeout.html", await page.content());
    throw new Error("Result links not found on Yahoo");
  }

  const searchResults = await page.evaluate(() => {
    const results: SearchResult[] = [];
    const elements = document.querySelectorAll(".algo-sr h3 a");

    for (let i = 0; i < Math.min(3, elements.length); i++) {
      const link = elements[i] as HTMLAnchorElement;
      const url = link.getAttribute("href") || "";
      const descriptionElement = link
        .closest(".algo-sr")
        ?.querySelector(".compText");

      results.push({
        title: link.textContent?.trim() || "",
        url,
        description: descriptionElement?.textContent?.trim() || "",
      });
    }
    return results;
  });

  return searchResults;
};

export const searchGoogle = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    let results: SearchResult[];
    try {
      // Try Bing first as the primary alternative
      results = await browserManager.withPage((page) =>
        searchYahoo(page, query)
      );
    } catch (error) {
      console.error("Bing search failed:", (error as Error).message);
      try {
        // Fallback to Yahoo
        results = await browserManager.withPage((page) =>
          searchBing(page, query)
        );
      } catch (error) {
        console.error("Yahoo search failed:", (error as Error).message);
        try {
          // Last resort: Google (manual CAPTCHA handling needed)
          results = await browserManager.withPage((page) =>
            searchDuckDuckGo(page, query)
          );
        } catch (error) {
          console.error("Google search failed:", (error as Error).message);
          if (
            (error as Error).message.includes("CAPTCHA") ||
            (error as Error).message.includes("load failure")
          ) {
            try {
              // Final fallback: DuckDuckGo
              results = await browserManager.withPage((page) =>
                searchYahoo(page, query)
              );
            } catch (error) {
              console.error(
                "DuckDuckGo search failed:",
                (error as Error).message
              );
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    }

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Search error:", (error as Error).message);
    if ((error as Error).message.includes("CAPTCHA")) {
      res.status(503).json({
        success: false,
        error:
          "Search blocked by CAPTCHA - try manual intervention with headless: false",
      });
    } else if ((error as Error).message.includes("not found")) {
      res.status(500).json({
        success: false,
        error:
          "Failed to locate search field or results - page structure may have changed",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to perform search",
      });
    }
  }
};

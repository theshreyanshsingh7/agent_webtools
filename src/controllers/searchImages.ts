import { Request, Response } from "express";
import { createBrowserManager } from "../utils/browserManager.js";
import { Page, Browser, BrowserContext } from "playwright";
import * as fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { uploadImageToS3 } from "../utils/s3.utils.js";

// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create browser manager
const browserManager = createBrowserManager();

// Types and interfaces
type SearchEngine = "yahoo" | "duckduckgo";

interface SearchQuery {
  query: string;
  engine?: SearchEngine;
}

interface SearchResponse {
  success: boolean;
  engine: SearchEngine;
  query: string;
  results?: ImageSearchResult[];
  count?: number;
  error?: string;
}

interface ViewportSize {
  width: number;
  height: number;
}

// User agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

// Viewports
const VIEWPORT_SIZES: ViewportSize[] = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
];

// Image result interface
interface ImageSearchResult {
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  width?: number;
  height?: number;
  cloudFrontUrl?: string;
}

// Utils
const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const getRandomViewport = () =>
  VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];

const randomDelay = (min: number, max: number): Promise<void> => {
  const delay = Math.floor(min + Math.random() * (max - min));
  return new Promise((res) => setTimeout(res, delay));
};

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
}

const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelay: 1000 }
): Promise<T> => {
  let lastError: any;
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay =
        options.baseDelay *
        Math.pow(2, attempt - 1) *
        (0.5 + Math.random() * 0.5);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

interface BrowserContextOptions {
  userAgent: string;
  viewport: ViewportSize;
  deviceScaleFactor: number;
  locale: string;
  timezoneId: string;
}

const setupStealthBrowser = async (
  browser: Browser
): Promise<BrowserContext> => {
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: getRandomViewport(),
    deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });

  // Load cookies
  try {
    const cookiesPath = path.join(__dirname, "..", "data", "cookies.json");
    const cookiesData = await fs.readFile(cookiesPath, "utf-8");
    const cookies = JSON.parse(cookiesData);
    if (cookies?.length) await context.addCookies(cookies);
  } catch {}

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin" },
        { name: "Chrome PDF Viewer" },
        { name: "Native Client" },
      ],
    });
  });

  return context;
};

const humanizedInteraction = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const totalHeight = document.body.scrollHeight;
    let scrolled = 0;
    const interval = setInterval(() => {
      const step = Math.random() * 100 + 50;
      window.scrollBy(0, step);
      scrolled += step;
      if (scrolled > totalHeight * 0.7) clearInterval(interval);
    }, Math.random() * 300 + 200);
  });

  for (let i = 0; i < 3; i++) {
    await page.mouse.move(Math.random() * 300, Math.random() * 300);
    await randomDelay(100, 300);
  }
};

// Yahoo Image Search
class SearchError extends Error {
  constructor(message: string, public readonly engine: SearchEngine) {
    super(message);
    this.name = "SearchError";
  }
}

const searchYahooImages = async (
  page: Page,
  query: string
): Promise<ImageSearchResult[]> => {
  await page.goto("https://images.search.yahoo.com", {
    waitUntil: "networkidle",
  });
  await randomDelay(1000, 2000);

  await page.fill("input[type='text']", query);
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(".ld");

  await humanizedInteraction(page);

  return await page.evaluate(() => {
    const items: ImageSearchResult[] = [];
    const results = document.querySelectorAll(".ld");
    results.forEach((el) => {
      const img = el.querySelector("img");
      if (img && img.src) {
        items.push({
          imageUrl: img.getAttribute("data-src") || img.src,
          thumbnailUrl: img.src,
          title: el.querySelector(".title")?.textContent || "",
          sourceUrl: el.querySelector("a")?.getAttribute("href") || "",
          sourceName: el.querySelector("a")?.textContent || "",
        });
      }
    });
    return items;
  });
};

// DuckDuckGo Image Search
const searchDuckDuckGoImages = async (
  page: Page,
  query: string
): Promise<ImageSearchResult[]> => {
  try {
    // Navigate to DuckDuckGo
    await page.goto("https://duckduckgo.com", { waitUntil: "networkidle" });
    await randomDelay(500, 1500);

    // Enter search query and submit
    await page.fill("input[name='q']", query);
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");

    try {
      await page.click('a[data-zci-link="images"]', { timeout: 5000 });
    } catch (err) {
      console.log("Images tab link not found, navigating directly");
      await page.goto(
        `https://duckduckgo.com/?q=${encodeURIComponent(
          query
        )}&iax=images&ia=images`,
        { waitUntil: "networkidle" }
      );
    }
    // Wait for image results with a fallback selector
    const imageSelector = "figure.nsogf_Hpj9UUxfhcwQd5 img";
    try {
      await page.waitForSelector(imageSelector, { timeout: 10000 });
    } catch (err) {
      console.error("Image selector not found, attempting fallback");
      // Fallback to any img tag within a figure
      await page.waitForSelector("figure img", { timeout: 10000 });
    }

    // Humanized interaction to mimic user behavior
    await humanizedInteraction(page);

    // Extract image results
    const results = await page.evaluate(() => {
      const items: ImageSearchResult[] = [];
      const imageElements = document.querySelectorAll(
        "figure.nsogf_Hpj9UUxfhcwQd5"
      );
      imageElements.forEach((figure) => {
        const img = figure.querySelector("img");
        const link = figure.querySelector("a");
        const titleElement = figure.querySelector("figcaption p span");
        const sourceElement = figure.querySelector(
          "figcaption p:last-child span"
        );
        const dimensionsElement = figure.querySelector("div p");

        if (img) {
          let rawUrl = img.getAttribute("src") || "";
          if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;
          const imageUrl = rawUrl;
          const title = titleElement?.textContent?.trim() || "";
          const sourceUrl = link?.getAttribute("href") || "";
          const sourceName = sourceElement?.textContent?.trim() || "";
          const dimensionsText = dimensionsElement?.textContent?.trim() || "";
          let width, height;

          // Parse dimensions if available (e.g., "758 × 1053")
          if (dimensionsText) {
            const [w, h] = dimensionsText.split(" × ").map(Number);
            width = w;
            height = h;
          }

          items.push({
            imageUrl,
            thumbnailUrl: imageUrl,
            title,
            sourceUrl,
            sourceName,
            width,
            height,
          });
        }
      });
      return items;
    });

    return results;
  } catch (err) {
    console.error("Error in searchDuckDuckGoImages:", err);
    throw new SearchError(
      err instanceof Error ? err.message : "Unknown error occurred",
      "duckduckgo"
    );
  }
};

// Main controller
export const searchImages = async (
  req: Request<{}, {}, {}, SearchQuery>,
  res: Response<SearchResponse>
): Promise<void> => {
  const { query, engine = "yahoo" } = req.query;

  if (!query || typeof query !== "string") {
    res.status(400).json({
      success: false,
      engine: engine,
      query: "",
      error: "Query is required",
    });
    return;
  }

  const engineStr =
    typeof engine === "string" &&
    (engine === "yahoo" || engine === "duckduckgo")
      ? engine
      : "duckduckgo";

  try {
    const results = await retry(
      async () => {
        return await browserManager.withPage(async (page) => {
          const context = page.context();

          // Apply stealth settings to existing context
          await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
            Object.defineProperty(navigator, "languages", {
              get: () => ["en-US", "en"],
            });
            Object.defineProperty(navigator, "plugins", {
              get: () => [
                { name: "Chrome PDF Plugin" },
                { name: "Chrome PDF Viewer" },
                { name: "Native Client" },
              ],
            });
          });

          try {
            const results =
              engineStr === "yahoo"
                ? await searchYahooImages(page, query)
                : await searchDuckDuckGoImages(page, query);

            const cookies = await context.cookies();
            await fs.mkdir(path.join(__dirname, "..", "data"), {
              recursive: true,
            });
            await fs.writeFile(
              path.join(__dirname, "..", "data", "cookies.json"),
              JSON.stringify(cookies)
            );

            return results;
          } catch (err) {
            await page.screenshot({
              path: path.join(
                __dirname,
                "..",
                "debug",
                `error-${Date.now()}.png`
              ),
            });
            throw err;
          }
        });
      },
      { maxRetries: 2, baseDelay: 3000 }
    );

    // Upload each image to S3 and get CloudFront URLs
    const limitedResults = results.slice(0, 1);
    const uploadPromises = limitedResults.map(async (result) => {
      try {
        const cloudFrontUrl = await uploadImageToS3(result.imageUrl, query);
        return {
          ...result,
          cloudFrontUrl,
        };
      } catch (error) {
        console.error("Error uploading to S3:", error);
        return result;
      }
    });

    const resultsWithCloudFrontUrls = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      engine: engineStr,
      query,
      results: resultsWithCloudFrontUrls,
      count: resultsWithCloudFrontUrls.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      engine: engineStr,
      query,
      error: err.message || "Unknown error",
    });
  }
};

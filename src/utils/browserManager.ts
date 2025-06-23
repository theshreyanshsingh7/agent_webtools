import { chromium, Browser, BrowserContext, Page } from "playwright";

export const createBrowserManager = () => {
  let browser: Browser | null = null;

  const getBrowser = async (): Promise<Browser> => {
    if (!browser) {
      try {
        browser = await chromium.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--lang=en-US,en",
          ],
        });
      } catch (error) {
        console.error("Failed to launch browser:", error);
        throw new Error("Browser initialization failed");
      }
    }
    return browser;
  };

  const closeBrowser = async (): Promise<void> => {
    if (browser) {
      await browser.close();
      browser = null;
    }
  };

  const withPage = async <T>(
    callback: (page: Page) => Promise<T>
  ): Promise<T> => {
    const browser = await getBrowser();
    const context: BrowserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      javaScriptEnabled: true, // JavaScript is enabled by default; this line is optional
    });
    const page: Page = await context.newPage();
    try {
      return await callback(page);
    } catch (error) {
      console.error("Page operation failed:", error);
      throw error;
    } finally {
      await context.close();
    }
  };

  return {
    getBrowser,
    closeBrowser,
    withPage,
  };
};

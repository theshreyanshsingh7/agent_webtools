import { Request, Response } from "express";
import { createBrowserManager } from "../utils/browserManager.js";
import * as cheerio from "cheerio";
import {
  uploadHTMLToS3,
  uploadImageBufferToS3,
  uploadImageToS3,
} from "../utils/s3.utils.js";
import { htmlToMarkdownAST } from "dom-to-semantic-markdown";

const browserManager = createBrowserManager();

interface PageSummary {
  headings: { tag: string; text: string }[];
  images: { src: string; alt: string }[];
  metaDescription: string;
  metaTitle: string;
}

async function extractPageSummary(htmlContent: string): Promise<PageSummary> {
  const $ = cheerio.load(htmlContent);

  // Extract headings
  const headings = $("h1, h2, h3")
    .map((_, el) => ({
      tag: el.tagName.toLowerCase(),
      text: $(el).text().trim(),
    }))
    .get();

  // Extract images
  const images = $("img")
    .map((_, el) => ({
      src: $(el).attr("src") || "",
      alt: $(el).attr("alt") || "",
    }))
    .get();

  const metaDescription = $('meta[name="description"]').attr("content") || "";
  const metaTitle = $("title").text().trim();

  return { headings, images, metaTitle, metaDescription };
}

export const takeScreenshot = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { url, full } = req.query;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const { screenshotBuffer, content } = await browserManager.withPage(
      async (page) => {
        await page.goto(url, { waitUntil: "domcontentloaded" });

        await page.waitForTimeout(2000); // for JS-heavy content

        const screenshotBuffer = await page.screenshot({
          fullPage: true,
          type: "png",
        });

        const htmlContent = await page.content();

        const content = await extractPageSummary(htmlContent);

        return { screenshotBuffer, content };
      }
    );

    const cloudFrontUrl = await uploadImageBufferToS3(screenshotBuffer, url);

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      screenshotUrl: cloudFrontUrl,
      html: content,
    });
  } catch (error) {
    console.error("Screenshot error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to take screenshot or extract HTML",
    });
  }
};

export const readSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, full } = req.query;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const { htmlContent } = await browserManager.withPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.waitForTimeout(2000);

      const htmlContent = await page.content();

      return { htmlContent };
    });

    const cloudFrontUrl = await uploadHTMLToS3(htmlContent, url);
    console.log("Extracted HTML:", cloudFrontUrl);

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Screenshot error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to take screenshot or extract HTML",
    });
  }
};

import { Router } from "express";
import { takeScreenshot } from "../controllers/screenshotController.js";

const router = Router();

// GET /api/screenshot?url=<website_url>
router.get("/", takeScreenshot);

export { router as screenshotRoutes };

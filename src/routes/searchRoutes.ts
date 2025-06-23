import { Router } from "express";
import { searchGoogle } from "../controllers/searchController.js";
import { searchImages } from "../controllers/searchImages.js";

const router = Router();

// GET /api/search?query=<search_term>
router.get("/", searchGoogle);
router.get("/images", searchImages);

export { router as searchRoutes };

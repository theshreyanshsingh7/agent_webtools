import express from "express";
import dotenv from "dotenv";
import { searchRoutes } from "./routes/searchRoutes.js";
import { screenshotRoutes } from "./routes/screenshotRoutes.js";

import morgan from "morgan";

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3237;

// Middleware
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/search", searchRoutes);
app.use("/api/screenshot", screenshotRoutes);

// Default route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to RELCIS APIs",
    endpoints: {
      search: "/api/search?query=<search_term>",
      screenshot: "/api/screenshot?url=<website_url>",
      navigate: "/api/navigate (POST with url and actions)",
    },
  });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

// Cleanup on server shutdown
// process.on("SIGTERM", async () => {
//   await createBrowserManager.;
//   process.exit(0);
// });

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

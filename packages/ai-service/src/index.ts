import express from "express";
import cors from "cors";
import helmet from "helmet";
import { chatRoutes } from "./routes/chat";
import { quotaRoutes } from "./routes/quota";
import { modelRoutes } from "./routes/models";
import { analyzeRoutes } from "./routes/analyze";
import { errorHandler } from "./middleware/error";
import { ipRateLimiter } from "./middleware/rate-limit";

const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "25mb" }));

// Rate limit AI requests: 60 req/min
app.use(ipRateLimiter({ maxRequests: 60, windowSeconds: 60, action: "ai-service" }));

// Health Check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-service",
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use("/ai/chat", chatRoutes);
app.use("/ai/quota", quotaRoutes);
app.use("/ai/models", modelRoutes);
app.use("/ai/analyze", analyzeRoutes);

// Error Handler
app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🧠 [Fin.IQ AI Service] Running on port ${PORT}`);
});

export default app;

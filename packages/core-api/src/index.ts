import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getRedisHealth } from "@finiq/shared";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { transactionRoutes } from "./routes/transactions";
import { accountRoutes } from "./routes/accounts";
import { categoryRoutes } from "./routes/categories";
import { budgetRoutes } from "./routes/budgets";
import { ledgerRoutes } from "./routes/ledgers";
import { analyticsRoutes } from "./routes/analytics";
import { importRoutes } from "./routes/import";
import { errorHandler } from "./middleware/error";
import { ipRateLimiter } from "./middleware/rate-limit";

const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "15mb" }));

// General IP Rate Limiting: 120 req/min
app.use(ipRateLimiter({ maxRequests: 120, windowSeconds: 60, action: "core-api" }));

// Health Check Endpoint
app.get("/health", async (_req, res) => {
  const redisHealth = await getRedisHealth();
  res.json({
    status: "ok",
    service: "core-api",
    timestamp: new Date().toISOString(),
    redis: redisHealth,
  });
});

// Mount Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/transactions", transactionRoutes);
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/budgets", budgetRoutes);
app.use("/ledgers", ledgerRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/import", importRoutes);

// Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Fin.IQ Core API] Running on port ${PORT}`);
  });
}

export default app;

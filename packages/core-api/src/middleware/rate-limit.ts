import { Request, Response, NextFunction } from "express";
import { checkIpRateLimit } from "@finiq/shared";

export function ipRateLimiter(options: {
  maxRequests?: number;
  windowSeconds?: number;
  action?: string;
} = {}) {
  const maxRequests = options.maxRequests ?? 60; // 60 requests
  const windowSeconds = options.windowSeconds ?? 60; // per 1 minute
  const action = options.action ?? "api";

  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract real client IP (support reverse proxies like Nginx)
    const forwarded = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    let clientIp = "";

    if (typeof forwarded === "string") {
      clientIp = forwarded.split(",")[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      clientIp = forwarded[0].trim();
    } else if (typeof realIp === "string") {
      clientIp = realIp.trim();
    } else {
      clientIp = req.socket.remoteAddress || "127.0.0.1";
    }

    try {
      const result = await checkIpRateLimit(clientIp, action, maxRequests, windowSeconds);

      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", result.remaining);

      if (!result.allowed) {
        res.setHeader("Retry-After", result.retryAfterSeconds);
        return res.status(429).json({
          success: false,
          error: "TooManyRequests",
          message: `Terlalu banyak permintaan dari IP Anda. Coba lagi dalam ${result.retryAfterSeconds} detik.`,
          retryAfter: result.retryAfterSeconds,
        });
      }

      next();
    } catch (err) {
      console.warn("[RateLimiter Error]", err);
      // Gracefully continue on rate limiter error so service doesn't break
      next();
    }
  };
}

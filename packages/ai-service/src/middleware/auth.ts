import { Request, Response, NextFunction } from "express";
import { verifySessionToken, isSessionRevoked, getCachedSession } from "@finiq/shared";

export interface AuthRequest extends Request {
  userId: string;
  userEmail: string;
  token: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Header Authorization Bearer token diperlukan",
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Token tidak valid",
    });
  }

  // 1. Check if token was revoked via Redis on logout
  const revoked = await isSessionRevoked(token);
  if (revoked) {
    return res.status(401).json({
      success: false,
      error: "SessionExpired",
      message: "Sesi telah berakhir atau Anda telah logout. Silakan login kembali.",
    });
  }

  // 2. Check Redis session cache
  const cached = await getCachedSession(token);
  if (cached && cached.userId) {
    (req as AuthRequest).userId = cached.userId;
    (req as AuthRequest).userEmail = cached.email;
    (req as AuthRequest).token = token;
    return next();
  }

  // 3. Verify JWT
  const payload = verifySessionToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      error: "InvalidToken",
      message: "Token tidak valid atau telah kadaluarsa",
    });
  }

  (req as AuthRequest).userId = payload.userId;
  (req as AuthRequest).userEmail = payload.email;
  (req as AuthRequest).token = token;
  next();
}

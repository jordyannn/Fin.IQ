import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[Core API Error]", err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Validasi parameter gagal",
      issues: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  if (err?.name === "SyntaxError" && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "BadRequest",
      message: "Format JSON request tidak valid",
    });
  }

  const statusCode = err?.statusCode || err?.status || 500;
  return res.status(statusCode).json({
    success: false,
    error: err?.code || "InternalServerError",
    message: err?.message || "Terjadi kesalahan internal pada server",
  });
}

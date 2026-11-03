import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { analyticsEvents } from "@/server/db/schema";
import { verifySessionToken } from "@/server/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const events: Array<{
      eventType: string;
      eventName: string;
      metadata?: Record<string, unknown>;
      sessionId?: string;
    }> = Array.isArray(body) ? body : [body];

    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    // Extract user from session cookie (optional)
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/(^|;\s*)finiq_session=([^;]*)/);
    const token = match ? decodeURIComponent(match[2]) : null;
    const payload = token ? verifySessionToken(token) : null;
    const userId = payload?.userId || null;

    // Extract request metadata
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent")?.slice(0, 512) || null;
    const referrer = req.headers.get("referer")?.slice(0, 512) || null;

    // Batch insert up to 50 events
    const rowsToInsert = events.slice(0, 50).map((e) => ({
      userId,
      sessionId: e.sessionId ? String(e.sessionId).slice(0, 64) : null,
      eventType: String(e.eventType || "custom").slice(0, 50),
      eventName: String(e.eventName || "unknown").slice(0, 255),
      metadata: e.metadata || null,
      ipAddress: ip.slice(0, 45),
      userAgent,
      referrer,
    }));

    await db.insert(analyticsEvents).values(rowsToInsert);

    return NextResponse.json({ ok: true, count: rowsToInsert.length });
  } catch (err: any) {
    console.error("Analytics track error:", err);
    // Return ok: false but HTTP 200 so clients don't crash
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
  }
}


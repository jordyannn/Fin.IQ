import { NextResponse } from "next/server";
import { deleteCachedSession } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/(^|;\s*)finiq_session=([^;]*)/);
    const sessionToken = match ? decodeURIComponent(match[2]) : null;

    if (sessionToken) {
      await deleteCachedSession(sessionToken);
    }
  } catch (err) {
    console.warn("Logout session cache cleanup warning:", err);
  }

  const response = NextResponse.json({
    success: true,
    message: "Berhasil keluar dari akun.",
  });

  // Clear session cookie
  response.cookies.set("finiq_session", "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });

  return response;
}

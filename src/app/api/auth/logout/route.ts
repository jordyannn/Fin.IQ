import { NextResponse } from "next/server";

export async function POST() {
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

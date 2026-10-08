import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "../auth";

export interface Context {
  db: typeof db;
  userId: string;
  userEmail?: string;
}

function parseCookie(cookieHeader?: string | null, name?: string): string | null {
  if (!cookieHeader || !name) return null;
  const match = cookieHeader.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function createContext(opts?: { req?: Request }): Promise<Context> {
  let authenticatedUserId: string | null = null;
  let authenticatedEmail: string | undefined = undefined;

  // 1. Try reading finiq_session cookie from request headers
  const cookieHeader = opts?.req?.headers.get("cookie");
  const sessionToken = parseCookie(cookieHeader, "finiq_session");

  if (sessionToken) {
    const payload = verifySessionToken(sessionToken);
    if (payload?.userId) {
      // Verify user actually exists in database
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (existing.length > 0 && existing[0].isEnabled) {
        authenticatedUserId = existing[0].id;
        authenticatedEmail = existing[0].email;
      }
    }
  }

  // 2. Try Bearer token in Authorization header
  if (!authenticatedUserId && opts?.req) {
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const payload = verifySessionToken(token);
      if (payload?.userId) {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.id, payload.userId))
          .limit(1);

        if (existing.length > 0 && existing[0].isEnabled) {
          authenticatedUserId = existing[0].id;
          authenticatedEmail = existing[0].email;
        }
      }
    }
  }

  return {
    db,
    userId: authenticatedUserId || "",
    userEmail: authenticatedEmail,
  };
}

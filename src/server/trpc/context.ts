import { db } from "../db";
import { users, userProfiles, ledgers, accounts } from "../db/schema";
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
  if (!match) return null;
  const val = decodeURIComponent(match[3]);
  return val.replace(/^"(.*)"$/, "$1").trim();
}

async function ensureUserProvisioned(userId: string, email: string): Promise<boolean> {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existing.length === 0) {
      // In serverless container lifecycle (AWS Lambda / Vercel),
      // each container gets an ephemeral /tmp/finiq.db initialized from the repo build bundle.
      // Auto-provision cryptographically-verified users so foreign keys and relations never break.
      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase().trim(),
        passwordHash: "session_verified_auto_provisioned",
        isAdmin: false,
        isEnabled: true,
      });

      const defaultName = email.split("@")[0] || "Pengguna";
      const displayName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);

      await db.insert(userProfiles).values({
        userId,
        displayName,
        primaryCurrency: "IDR",
        themePrimaryColor: "#00B569",
        totpEnabled: false,
      });

      await db.insert(ledgers).values({
        userId,
        name: "Buku Kas Utama",
        currency: "IDR",
        monthStartDay: 1,
      });

      await db.insert(accounts).values({
        userId,
        name: "Kas Tunai",
        group: "Cash",
        currency: "IDR",
        initialBalance: 0,
        balance: 0,
        note: "Dompet uang tunai utama",
      });

      return true;
    }

    return existing[0].isEnabled;
  } catch (err) {
    console.warn("Context user provisioning note:", err);
    return true; // Still allow authenticated user if already verified cryptographically
  }
}

export async function createContext(opts?: { req?: Request }): Promise<Context> {
  let authenticatedUserId: string | null = null;
  let authenticatedEmail: string | undefined = undefined;

  let sessionToken: string | null = null;

  // 1. Try reading from next/headers cookies() first (most reliable in Next.js App Router)
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const c = cookieStore.get("finiq_session");
    if (c?.value) {
      sessionToken = c.value.replace(/^"(.*)"$/, "$1").trim();
    }
  } catch {
    // If not in Next.js request headers scope, fallback to raw req headers
  }

  // 2. Try raw cookie header if not found
  if (!sessionToken && opts?.req) {
    const cookieHeader = opts.req.headers.get("cookie");
    sessionToken = parseCookie(cookieHeader, "finiq_session");
  }

  // 3. Verify session token
  if (sessionToken) {
    const payload = verifySessionToken(sessionToken);
    if (payload?.userId) {
      const isAllowed = await ensureUserProvisioned(payload.userId, payload.email);
      if (isAllowed) {
        authenticatedUserId = payload.userId;
        authenticatedEmail = payload.email;
      }
    }
  }

  // 4. Try Bearer token in Authorization header
  if (!authenticatedUserId && opts?.req) {
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const payload = verifySessionToken(token);
      if (payload?.userId) {
        const isAllowed = await ensureUserProvisioned(payload.userId, payload.email);
        if (isAllowed) {
          authenticatedUserId = payload.userId;
          authenticatedEmail = payload.email;
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

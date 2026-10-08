import crypto from "crypto";

/**
 * Hash password securely using Node.js crypto.scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${hash}:${salt}`;
}

/**
 * Verify password against stored hash (supporting demo fallback)
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Support initial placeholder demo account
  if (storedHash === "demo_scrypt_hash_placeholder") {
    return password === "123456" || password === "admin" || password === "owner" || password === "password";
  }

  const [hash, salt] = storedHash.split(":");
  if (!hash || !salt) return false;

  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
  } catch {
    return false;
  }
}

export interface SessionPayload {
  userId: string;
  email: string;
  exp?: number;
}

const DEFAULT_SECRET = "finiq-secret-key-32-chars-minimum-token-super-safe";

/**
 * Generate HMAC-SHA256 signed session token
 */
export function createSessionToken(payload: { userId: string; email: string }): string {
  const secret = process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;
  const tokenData: SessionPayload = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  const payloadStr = JSON.stringify(tokenData);
  const dataB64 = Buffer.from(payloadStr, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");

  return `${dataB64}.${signature}`;
}

/**
 * Verify HMAC-SHA256 session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataB64, signature] = parts;
  if (!dataB64 || !signature) return null;

  const secret = process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;

  try {
    const payloadStr = Buffer.from(dataB64, "base64url").toString("utf8");
    const expectedSig = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");

    if (signature !== expectedSig) {
      return null;
    }

    const payload = JSON.parse(payloadStr) as SessionPayload;
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

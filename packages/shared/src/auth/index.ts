import crypto from "crypto";
import jwt from "jsonwebtoken";

export interface SessionPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_SECRET = "finiq-secret-key-32-chars-minimum-token-super-safe";
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = "30d";

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

/**
 * Generate standard JWT session token
 */
export function createSessionToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify session token (supports both JWT and legacy HMAC for seamless transition)
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;

  // 1. Try standard JWT verification
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    if (decoded && decoded.userId) {
      return decoded;
    }
  } catch {
    // Fall through to legacy HMAC check
  }

  // 2. Legacy HMAC verification for backward compatibility during rollout
  try {
    const parts = token.split(".");
    if (parts.length === 2) {
      const [dataB64, signature] = parts;
      if (dataB64 && signature) {
        const secret = process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;
        const payloadStr = Buffer.from(dataB64, "base64url").toString("utf8");
        const expectedSig = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
        if (signature === expectedSig) {
          const payload = JSON.parse(payloadStr) as SessionPayload;
          if (!payload.exp || payload.exp >= Date.now()) {
            return payload;
          }
        }
      }
    }
  } catch {
    // Ignore legacy parse errors
  }

  return null;
}

/**
 * AES-256-GCM symmetric encryption for sensitive user data (e.g. BYOK Gemini API Key)
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || DEFAULT_SECRET;
  return crypto.createHash("sha256").update(secret).digest(); // always 32 bytes
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:v1:")) {
    // Legacy plaintext fallback
    return cipherText;
  }
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 5) return cipherText;
    const [, , ivHex, tagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[Decrypt Error] Gagal mendekripsi secret:", err);
    return "";
  }
}

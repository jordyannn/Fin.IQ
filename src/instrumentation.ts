/**
 * Next.js Server Lifecycle Instrumentation
 *
 * Runs once on server startup to sanitize environment variables
 * and protect against placeholder values (e.g. "x") in production clusters.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const isPlaceholder = (val?: string | null): boolean => {
      if (!val) return false;
      const trimmed = val.trim().toLowerCase();
      return (
        trimmed === "x" ||
        trimmed === "..." ||
        trimmed === "placeholder" ||
        trimmed === "none" ||
        trimmed === "null" ||
        trimmed === "undefined"
      );
    };

    // 1. Sanitize Next.js Server Action Encryption Key & Reference IDs
    // If NEXT_PUBLIC_SERVER_REFERENCE_ID or NEXT_SERVER_ACTIONS_ENCRYPTION_KEY was set to "x"
    // in cluster secrets, it causes "The Server Reference ID did not match the expected format"
    if (process.env.NEXT_PUBLIC_SERVER_REFERENCE_ID) {
      console.warn("⚠️ [Instrumentation] Menghapus NEXT_PUBLIC_SERVER_REFERENCE_ID placeholder ('" + process.env.NEXT_PUBLIC_SERVER_REFERENCE_ID + "').");
      delete process.env.NEXT_PUBLIC_SERVER_REFERENCE_ID;
    }
    if (process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
      const key = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY.trim();
      if (isPlaceholder(key) || key.length < 32) {
        console.warn("⚠️ [Instrumentation] Menghapus NEXT_SERVER_ACTIONS_ENCRYPTION_KEY yang tidak valid ('" + key + "') agar Next.js menghasilkan key valid.");
        delete process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
      }
    }

    // 2. Sanitize Auth Secrets & URLs
    const DEFAULT_SECRET = "finiq-secret-key-32-chars-minimum-token-super-safe";
    if (isPlaceholder(process.env.NEXTAUTH_SECRET) || (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 8)) {
      console.warn("⚠️ [Instrumentation] Mengganti NEXTAUTH_SECRET placeholder dengan default safe secret.");
      process.env.NEXTAUTH_SECRET = DEFAULT_SECRET;
    }
    if (isPlaceholder(process.env.JWT_SECRET) || (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 8)) {
      process.env.JWT_SECRET = DEFAULT_SECRET;
    }
    if (isPlaceholder(process.env.NEXTAUTH_URL)) {
      process.env.NEXTAUTH_URL = "https://fin-iq.my.id";
    }

    // 3. Sanitize AI Keys (placeholder keys cause 401/429 spam to upstream providers)
    if (isPlaceholder(process.env.OPENROUTER_API_KEY)) {
      delete process.env.OPENROUTER_API_KEY;
    }
    if (isPlaceholder(process.env.OPENROUTER)) {
      delete process.env.OPENROUTER;
    }
    if (isPlaceholder(process.env.GEMINI_API_KEY)) {
      delete process.env.GEMINI_API_KEY;
    }
    if (isPlaceholder(process.env.GEMINI)) {
      delete process.env.GEMINI;
    }

    // 4. Sanitize Service URLs & Redis
    if (isPlaceholder(process.env.CORE_API_URL) || (process.env.CORE_API_URL && !process.env.CORE_API_URL.startsWith("http"))) {
      delete process.env.CORE_API_URL;
    }
    if (isPlaceholder(process.env.AI_SERVICE_URL) || (process.env.AI_SERVICE_URL && !process.env.AI_SERVICE_URL.startsWith("http"))) {
      delete process.env.AI_SERVICE_URL;
    }
    if (isPlaceholder(process.env.REDIS_URL) || (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith("redis"))) {
      delete process.env.REDIS_URL;
    }

    // 5. Sanitize Database URL
    if (isPlaceholder(process.env.DATABASE_URL) || (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("mysql://"))) {
      delete process.env.DATABASE_URL;
    }

    // 6. Sanitize Demo User ID
    if (isPlaceholder(process.env.DEMO_USER_ID)) {
      delete process.env.DEMO_USER_ID;
    }

    console.log("✅ [Fin.IQ Instrumentation] Environment variables sanitized successfully.");
  }
}

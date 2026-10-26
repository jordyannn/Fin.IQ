import Redis from "ioredis";

export interface CachedAuthUser {
  id: string;
  email: string;
  passwordHash: string;
  isEnabled: boolean;
  isAdmin: boolean;
  displayName: string;
  primaryCurrency: string;
}

export interface CachedSession {
  userId: string;
  email: string;
  displayName: string;
  primaryCurrency: string;
  isAdmin: boolean;
  createdAt: number;
}

// In-Memory Fallback Cache jika Redis belum terhubung / offline
const memoryCache = new Map<string, { data: any; expiry: number }>();

function getFromMemory<T>(key: string): T | null {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

function setToMemory(key: string, data: any, ttlSeconds: number) {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

function deleteFromMemory(key: string) {
  memoryCache.delete(key);
}

// Singleton Redis Client
let redisInstance: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (redisInstance) {
    return redisInstance;
  }

  try {
    const isTls = redisUrl.startsWith("rediss://");
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 4000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          isRedisAvailable = false;
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 100, 1000);
      },
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    });

    redisInstance.on("connect", () => {
      isRedisAvailable = true;
      console.log("✅ [Fin.IQ Redis] Connected successfully to Redis server.");
    });

    redisInstance.on("ready", () => {
      isRedisAvailable = true;
    });

    redisInstance.on("error", (err) => {
      isRedisAvailable = false;
      // Jangan throw error agar aplikasi tetap berjalan dengan fallback
      console.warn("⚠️ [Fin.IQ Redis] Connection warning (using fallback):", err.message);
    });

    redisInstance.on("close", () => {
      isRedisAvailable = false;
    });

    // Coba koneksi di background
    redisInstance.connect().catch((err) => {
      isRedisAvailable = false;
      console.warn("⚠️ [Fin.IQ Redis] Could not connect to REDIS_URL, running in memory-fallback mode:", err.message);
    });

    return redisInstance;
  } catch (err: any) {
    console.warn("⚠️ [Fin.IQ Redis] Initialization error:", err.message);
    return null;
  }
}

// Inisialisasi awal saat modul dimuat
if (typeof window === "undefined" && process.env.REDIS_URL) {
  getRedisClient();
}

const PREFIX = {
  USER: "finiq:auth:user:",
  SESSION: "finiq:auth:session:",
  REVOKED_TOKEN: "finiq:auth:revoked:",
  RATELIMIT: "finiq:ratelimit:login:",
  RATELIMIT_IP: "finiq:ratelimit:ip:",
};

/**
 * 1. USER CACHING: Ambil data user dari Redis terlebih dahulu sebelum ke DB
 */
export async function getCachedAuthUser(email: string): Promise<CachedAuthUser | null> {
  const emailLower = email.trim().toLowerCase();
  const key = `${PREFIX.USER}${emailLower}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      const raw = await client.get(key);
      if (raw) {
        return JSON.parse(raw) as CachedAuthUser;
      }
    } catch (err) {
      console.warn("[Redis getCachedAuthUser error, falling back]", err);
    }
  }

  return getFromMemory<CachedAuthUser>(key);
}

/**
 * Simpan data user ke Redis (Default TTL: 24 jam)
 */
export async function setCachedAuthUser(
  email: string,
  user: CachedAuthUser,
  ttlSeconds = 86400
): Promise<void> {
  const emailLower = email.trim().toLowerCase();
  const key = `${PREFIX.USER}${emailLower}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      await client.set(key, JSON.stringify(user), "EX", ttlSeconds);
    } catch (err) {
      console.warn("[Redis setCachedAuthUser error]", err);
    }
  }

  setToMemory(key, user, ttlSeconds);
}

/**
 * Hapus / Invalidate cache user (misal saat ganti password atau ubah profil)
 */
export async function invalidateAuthUser(email: string): Promise<void> {
  const emailLower = email.trim().toLowerCase();
  const key = `${PREFIX.USER}${emailLower}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      await client.del(key);
    } catch (err) {
      console.warn("[Redis invalidateAuthUser error]", err);
    }
  }

  deleteFromMemory(key);
}

/**
 * 2. SESSION CACHING: Simpan sesi login user di Redis agar /api/auth/me instan
 */
export async function getCachedSession(token: string): Promise<CachedSession | null> {
  if (!token) return null;
  const key = `${PREFIX.SESSION}${token}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      const raw = await client.get(key);
      if (raw) {
        return JSON.parse(raw) as CachedSession;
      }
    } catch (err) {
      console.warn("[Redis getCachedSession error]", err);
    }
  }

  return getFromMemory<CachedSession>(key);
}

export async function setCachedSession(
  token: string,
  session: CachedSession,
  ttlSeconds = 30 * 86400
): Promise<void> {
  if (!token) return;
  const key = `${PREFIX.SESSION}${token}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      await client.set(key, JSON.stringify(session), "EX", ttlSeconds);
    } catch (err) {
      console.warn("[Redis setCachedSession error]", err);
    }
  }

  setToMemory(key, session, ttlSeconds);
}

export async function deleteCachedSession(token: string): Promise<void> {
  if (!token) return;
  const key = `${PREFIX.SESSION}${token}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      await client.del(key);
    } catch (err) {
      console.warn("[Redis deleteCachedSession error]", err);
    }
  }

  deleteFromMemory(key);
  await revokeSessionToken(token, 30 * 86400);
}

export async function revokeSessionToken(token: string, ttlSeconds = 30 * 86400): Promise<void> {
  if (!token) return;
  const key = `${PREFIX.REVOKED_TOKEN}${token}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      await client.set(key, "1", "EX", ttlSeconds);
    } catch (err) {
      console.warn("[Redis revokeSessionToken error]", err);
    }
  }

  setToMemory(key, true, ttlSeconds);
}

export async function isSessionRevoked(token: string): Promise<boolean> {
  if (!token) return true;
  const key = `${PREFIX.REVOKED_TOKEN}${token}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      const exists = await client.exists(key);
      if (exists === 1) return true;
    } catch (err) {
      console.warn("[Redis isSessionRevoked error]", err);
    }
  }

  return getFromMemory<boolean>(key) === true;
}

export async function checkIpRateLimit(
  ip: string,
  action: string = "general",
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<{
  allowed: boolean;
  current: number;
  remaining: number;
  retryAfterSeconds: number;
}> {
  const cleanIp = ip.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const key = `${PREFIX.RATELIMIT_IP}${action}:${cleanIp}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      const pipeline = client.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);
      const results = await pipeline.exec();

      const count = (results?.[0]?.[1] as number) || 1;
      let ttl = (results?.[1]?.[1] as number) || -1;

      if (ttl === -1) {
        await client.expire(key, windowSeconds);
        ttl = windowSeconds;
      }

      if (count > maxRequests) {
        return {
          allowed: false,
          current: count,
          remaining: 0,
          retryAfterSeconds: Math.max(1, ttl),
        };
      }

      return {
        allowed: true,
        current: count,
        remaining: Math.max(0, maxRequests - count),
        retryAfterSeconds: 0,
      };
    } catch (err) {
      console.warn("[Redis checkIpRateLimit error]", err);
    }
  }

  const mem = getFromMemory<{ count: number; expiry: number }>(key);
  const now = Date.now();
  if (!mem || now > mem.expiry) {
    setToMemory(key, { count: 1, expiry: now + windowSeconds * 1000 }, windowSeconds);
    return {
      allowed: true,
      current: 1,
      remaining: maxRequests - 1,
      retryAfterSeconds: 0,
    };
  }

  const nextCount = mem.count + 1;
  const remainingSeconds = Math.max(1, Math.round((mem.expiry - now) / 1000));
  mem.count = nextCount;

  if (nextCount > maxRequests) {
    return {
      allowed: false,
      current: nextCount,
      remaining: 0,
      retryAfterSeconds: remainingSeconds,
    };
  }

  return {
    allowed: true,
    current: nextCount,
    remaining: maxRequests - nextCount,
    retryAfterSeconds: 0,
  };
}

/**
 * 3. RATE LIMITING LOGIN: Proteksi brute-force langsung di level Redis
 * Maksimal 5x gagal dalam 15 menit per identifier (IP + Email)
 */
export async function checkLoginRateLimit(identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}> {
  const maxAttempts = 5;
  const windowSeconds = 15 * 60; // 15 menit
  const key = `${PREFIX.RATELIMIT}${identifier}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      const current = await client.get(key);
      const attempts = current ? parseInt(current, 10) : 0;

      if (attempts >= maxAttempts) {
        const ttl = await client.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
        };
      }

      return {
        allowed: true,
        remaining: maxAttempts - attempts,
        retryAfterSeconds: 0,
      };
    } catch (err) {
      console.warn("[Redis checkLoginRateLimit error]", err);
    }
  }

  // Fallback memory rate limiter
  const memData = getFromMemory<{ attempts: number; expiry: number }>(key);
  const attempts = memData?.attempts || 0;
  if (attempts >= maxAttempts) {
    const remainingTime = Math.max(1, Math.round(((memData?.expiry || 0) - Date.now()) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: remainingTime,
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - attempts,
    retryAfterSeconds: 0,
  };
}

/**
 * Catat percobaan login (increment jika gagal, hapus jika sukses)
 */
export async function recordLoginAttempt(identifier: string, success: boolean): Promise<void> {
  const windowSeconds = 15 * 60;
  const key = `${PREFIX.RATELIMIT}${identifier}`;

  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      if (success) {
        await client.del(key);
      } else {
        const pipeline = client.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, windowSeconds);
        await pipeline.exec();
      }
    } catch (err) {
      console.warn("[Redis recordLoginAttempt error]", err);
    }
  }

  // Memory fallback
  if (success) {
    deleteFromMemory(key);
  } else {
    const memData = getFromMemory<{ attempts: number; expiry: number }>(key);
    const newAttempts = (memData?.attempts || 0) + 1;
    setToMemory(key, { attempts: newAttempts, expiry: Date.now() + windowSeconds * 1000 }, windowSeconds);
  }
}

/**
 * Status koneksi Redis saat ini untuk health-check
 */
export async function getRedisHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  provider: "redis" | "memory-fallback";
}> {
  const configured = Boolean(process.env.REDIS_URL);
  const client = getRedisClient();

  if (!configured || !client) {
    return { configured: false, connected: false, provider: "memory-fallback" };
  }

  try {
    const ping = await client.ping();
    return {
      configured: true,
      connected: ping === "PONG",
      provider: ping === "PONG" ? "redis" : "memory-fallback",
    };
  } catch {
    return { configured: true, connected: false, provider: "memory-fallback" };
  }
}

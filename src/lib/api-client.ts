/**
 * REST API Client for Fin.IQ Microservices
 *
 * Facilitates server-side and client-side communication with:
 * 1. Core API Service (Port 4000)
 * 2. AI Service (Port 5000)
 */

function sanitizeBaseUrl(val?: string | null, fallbackServer = "", fallbackClient = ""): string {
  if (val) {
    const trimmed = val.trim();
    if (
      trimmed &&
      trimmed.toLowerCase() !== "x" &&
      !trimmed.startsWith("...") &&
      (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/"))
    ) {
      return trimmed;
    }
  }
  return typeof window === "undefined" ? fallbackServer : fallbackClient;
}

const CORE_API_URL = sanitizeBaseUrl(process.env.CORE_API_URL, "http://127.0.0.1:4000", "/api/v1");
const AI_SERVICE_URL = sanitizeBaseUrl(process.env.AI_SERVICE_URL, "http://127.0.0.1:5000", "/api/ai");

export interface ApiClientOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: any;
  token?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function coreApi<T = any>(
  path: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = CORE_API_URL.endsWith("/") ? CORE_API_URL.slice(0, -1) : CORE_API_URL;
  const url = new URL(`${base}${cleanPath}`, "http://dummy");

  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const targetUrl = CORE_API_URL.startsWith("http")
    ? `${url.origin === "http://dummy" ? base : url.origin}${url.pathname}${url.search}`
    : `${base}${url.pathname}${url.search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(targetUrl, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || json.error || `Core API Error: ${res.status}`);
  }

  return json.data !== undefined ? json.data : json;
}

export async function aiApi<T = any>(
  path: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = AI_SERVICE_URL.endsWith("/") ? AI_SERVICE_URL.slice(0, -1) : AI_SERVICE_URL;
  const url = new URL(`${base}${cleanPath}`, "http://dummy");

  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const targetUrl = AI_SERVICE_URL.startsWith("http")
    ? `${url.origin === "http://dummy" ? base : url.origin}${url.pathname}${url.search}`
    : `${base}${url.pathname}${url.search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(targetUrl, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || json.error || `AI Service Error: ${res.status}`);
  }

  return json.data !== undefined ? json.data : json;
}

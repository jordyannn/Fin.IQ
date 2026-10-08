import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;

  // Cloud Turso database URL takes precedence
  if (envUrl && (envUrl.startsWith("libsql://") || envUrl.startsWith("https://"))) {
    return envUrl;
  }

  // When running on Vercel Serverless environment:
  // /var/task is read-only; copy initial seeded finiq.db into /tmp/finiq.db for full read/write support
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = path.join("/tmp", "finiq.db");
    if (!fs.existsSync(tmpPath)) {
      const candidates = [
        path.join(process.cwd(), "finiq.db"),
        path.join(__dirname, "../../../finiq.db"),
        path.join(__dirname, "../../../../finiq.db"),
        path.resolve("./finiq.db"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            fs.copyFileSync(candidate, tmpPath);
            break;
          } catch {
            // Ignore copy failure
          }
        }
      }
    }
    return `file:${tmpPath}`;
  }

  return envUrl || "file:finiq.db";
}

const url = resolveDatabaseUrl();
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Libsql client works seamlessly with local file:finiq.db and cloud Turso edge DB
export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;

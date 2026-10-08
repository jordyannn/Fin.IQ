import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "file:finiq.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Libsql client works seamlessly with local file:finiq.db and cloud Turso edge DB
export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;

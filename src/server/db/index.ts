import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import * as dotenv from "dotenv";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
}

const connectionUri = process.env.DATABASE_URL;

if (!connectionUri) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const pool = mysql.createPool({
  uri: connectionUri,
  ssl: {
    rejectUnauthorized: false,
  },
  connectTimeout: 30000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: "default" });
export type Database = typeof db;

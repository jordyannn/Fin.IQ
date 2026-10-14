import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import * as dotenv from "dotenv";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
}

const connectionUri =
  process.env.DATABASE_URL ||
  "mysql://avnadmin:AVNS_CpIAQBJBbUy_hH9zbT8@finiq-1-jordanngz12-6510.c.aivencloud.com:12551/defaultdb";

// Docker container dan koneksi localhost tidak menggunakan SSL
const isLocalOrDocker =
  connectionUri.includes("finiq-db") ||
  connectionUri.includes("localhost") ||
  connectionUri.includes("127.0.0.1");

try {
  const parsed = new URL(connectionUri);
  console.log(`[Database] Connecting to MySQL Host: ${parsed.hostname}:${parsed.port || 3306} (SSL: ${!isLocalOrDocker})`);
} catch {
  console.log("[Database] Connecting to database using configured URI");
}

export const pool = mysql.createPool({
  uri: connectionUri,
  ...(isLocalOrDocker
    ? {}
    : {
        ssl: {
          rejectUnauthorized: false,
        },
      }),
  connectTimeout: 30000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: "default" });
export type Database = typeof db;

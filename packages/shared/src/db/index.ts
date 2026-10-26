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

type AppDatabase = ReturnType<typeof drizzle<typeof schema, mysql.Pool>>;

interface GlobalWithDb {
  __finiq_mysql_pool?: mysql.Pool;
  __finiq_drizzle_db?: AppDatabase;
}

const globalForDb = globalThis as unknown as GlobalWithDb;

export const pool =
  globalForDb.__finiq_mysql_pool ??
  mysql.createPool({
    uri: connectionUri,
    ...(isLocalOrDocker
      ? {}
      : {
          ssl: {
            rejectUnauthorized: false,
          },
        }),
    connectTimeout: 15000,
    waitForConnections: true,
    connectionLimit: 4,
    maxIdle: 2,
    idleTimeout: 30000,
    queueLimit: 0,
  });

export const db =
  globalForDb.__finiq_drizzle_db ??
  drizzle(pool, { schema, mode: "default" });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__finiq_mysql_pool = pool;
  globalForDb.__finiq_drizzle_db = db;
}

export type Database = typeof db;
export * from "./schema";

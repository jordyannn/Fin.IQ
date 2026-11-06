import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import mysql from "mysql2/promise";

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  console.log("[Migration] Connecting to database...");
  const connection = await mysql.createConnection({
    uri,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 20000,
  });

  console.log("[Migration] Connected! Creating table milestones if not exists...");
  const sql = `
    CREATE TABLE IF NOT EXISTS \`milestones\` (
      \`id\` varchar(36) NOT NULL,
      \`user_id\` varchar(36) NOT NULL,
      \`title\` varchar(255) NOT NULL,
      \`target_amount\` double NOT NULL,
      \`tracking_type\` varchar(20) NOT NULL,
      \`tracking_id\` varchar(36) NOT NULL,
      \`tracking_direction\` varchar(20) NOT NULL DEFAULT 'savings_goal',
      \`deadline\` timestamp NOT NULL,
      \`is_completed\` tinyint(1) NOT NULL DEFAULT 0,
      \`completed_at\` timestamp NULL DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_milestones_user_deadline\` (\`user_id\`, \`deadline\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.query(sql);
  console.log("[Migration] Table milestones successfully verified/created in database!");
  await connection.end();
}

main().catch((err) => {
  console.error("[Migration Error]", err);
  process.exit(1);
});


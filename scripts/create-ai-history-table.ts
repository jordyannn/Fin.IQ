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

  console.log("[Migration] Connected! Creating table ai_prompt_history if not exists...");
  const sql = `
    CREATE TABLE IF NOT EXISTS \`ai_prompt_history\` (
      \`id\` varchar(36) NOT NULL,
      \`user_id\` varchar(36) NOT NULL,
      \`question\` text NOT NULL,
      \`answer\` text NOT NULL,
      \`model_used\` varchar(150) NOT NULL,
      \`guardrail_blocked\` tinyint(1) NOT NULL DEFAULT 0,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_ai_history_user_time\` (\`user_id\`, \`created_at\`),
      CONSTRAINT \`fk_ai_history_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.query(sql);
  console.log("[Migration] Table ai_prompt_history successfully verified/created in database!");
  await connection.end();
}

main().catch((err) => {
  console.error("[Migration Error]", err);
  process.exit(1);
});

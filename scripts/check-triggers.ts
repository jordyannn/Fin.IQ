import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { pool } from "../src/server/db";

async function main() {
  const [triggers] = await pool.query("SHOW TRIGGERS");
  console.log("TRIGGERS:", triggers);
  await pool.end();
}

main().catch(console.error);


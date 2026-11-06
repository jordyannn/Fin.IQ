import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { db, pool } from "../src/server/db";
import { users, categories } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const user = await db.query.users.findFirst({ where: eq(users.email, "jordan@finiq.app") });
  const cats = await db.select().from(categories).where(eq(categories.userId, user!.id));
  for (const c of cats) {
    console.log(`${c.id} | ${c.name} | ${c.kind} | ${c.icon}`);
  }
  await pool.end();
}

main().catch(console.error);


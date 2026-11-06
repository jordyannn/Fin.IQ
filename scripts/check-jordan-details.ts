import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { db, pool } from "../src/server/db";
import { users, userProfiles, ledgers, accounts, categories } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const user = await db.query.users.findFirst({ where: eq(users.email, "jordan@finiq.app") });
  if (!user) {
    console.log("Jordan not found");
    await pool.end();
    return;
  }
  const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, user.id) });
  console.log("PROFILE:", profile);
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id));
  console.log("ACCOUNTS:", userAccounts);
  const userLedgers = await db.select().from(ledgers).where(eq(ledgers.userId, user.id));
  console.log("LEDGERS:", userLedgers);
  const userCats = await db.select().from(categories).where(eq(categories.userId, user.id));
  console.log("CATEGORIES COUNT:", userCats.length);
  await pool.end();
}

main().catch(console.error);


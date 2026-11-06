import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { db, pool } from "../src/server/db";
import { users, accounts, ledgers, categories, transactions, aiChatSessions, aiChatMessages } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const user = await db.query.users.findFirst({ where: eq(users.email, "jordan@finiq.app") });
  console.log("USER:", user);
  if (!user) {
    await pool.end();
    return;
  }
  const userLedgers = await db.select().from(ledgers).where(eq(ledgers.userId, user.id));
  console.log("LEDGERS:", userLedgers);
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id));
  console.log("ACCOUNTS:", userAccounts);
  const userCategories = await db.select().from(categories).where(eq(categories.userId, user.id));
  console.log("CATEGORIES COUNT:", userCategories.length);
  const userTx = await db.select().from(transactions).where(eq(transactions.userId, user.id));
  console.log("TRANSACTIONS COUNT:", userTx.length);
  const sessions = await db.select().from(aiChatSessions).where(eq(aiChatSessions.userId, user.id));
  console.log("AI SESSIONS:", sessions);
  await pool.end();
}

main().catch(console.error);


import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { db, pool } from "../src/server/db";
import { accounts, transactions } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const accs = await db.select().from(accounts);
  for (const a of accs) {
    if (a.userId === 'b9cbba6e-d363-4388-bc0b-362becd57398') {
      console.log(`Account: ${a.name} (${a.id}) balance: ${a.balance}`);
      const txs = await db.select().from(transactions).where(eq(transactions.accountId, a.id));
      for (const t of txs) {
        console.log(`  tx: ${t.note} | amount: ${t.amount} | type: ${t.txType}`);
      }
    }
  }
  await pool.end();
}

main().catch(console.error);


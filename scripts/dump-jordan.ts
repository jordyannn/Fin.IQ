import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { pool } from "../src/server/db";

async function main() {
  const [txs] = await pool.query(
    "SELECT id, note, amount, tx_type, account_id, happened_at FROM transactions WHERE user_id = 'b9cbba6e-d363-4388-bc0b-362becd57398' ORDER BY happened_at DESC"
  );
  console.log("Total txs:", (txs as any[]).length);
  for (const t of txs as any[]) {
    console.log(
      `${t.happened_at.toISOString().slice(0, 16)} | ${t.tx_type.padEnd(8)} | Rp ${String(
        t.amount
      ).padStart(8)} | ${t.note}`
    );
  }
  const [accs] = await pool.query(
    "SELECT id, name, `group`, balance FROM accounts WHERE user_id = 'b9cbba6e-d363-4388-bc0b-362becd57398'"
  );
  console.log("\nAccounts in DB:");
  for (const a of accs as any[]) {
    console.log(`- ${a.name} (${a.group}): Rp ${a.balance.toLocaleString("id-ID")}`);
  }
  await pool.end();
}

main().catch(console.error);

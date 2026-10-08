import { db } from "../src/server/db";

async function main() {
  const usersList = await db.query.users.findMany();
  console.log("=== USERS IN DB ===");
  console.log(usersList);

  const accountsList = await db.query.accounts.findMany();
  console.log("=== ACCOUNTS IN DB ===");
  console.log(accountsList);

  const ledgersList = await db.query.ledgers.findMany();
  console.log("=== LEDGERS IN DB ===");
  console.log(ledgersList);
}

main().catch(console.error);

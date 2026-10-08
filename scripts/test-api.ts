import { appRouter } from "../src/server/trpc/router/root";
import { createContext } from "../src/server/trpc/context";

async function test() {
  const ctx = await createContext();
  console.log("Active User ID in Context:", ctx.userId);

  const caller = appRouter.createCaller(ctx);
  const accountsRes = await caller.accounts.list({});
  console.log("Accounts Result:", accountsRes);

  const txRes = await caller.transactions.list({ limit: 10 });
  console.log("Transactions Count:", txRes.items.length);

  const summary = await caller.analytics.summary();
  console.log("Analytics Summary:", summary);
}

test().catch(console.error);

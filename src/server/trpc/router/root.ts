import { router } from "../trpc";
import { transactionsRouter } from "./transactions";
import { accountsRouter } from "./accounts";
import { categoriesRouter } from "./categories";
import { budgetsRouter } from "./budgets";
import { ledgersRouter } from "./ledgers";
import { analyticsRouter } from "./analytics";
import { aiRouter } from "./ai";
import { importRouter } from "./import";
import { authRouter } from "./auth";
import { userRouter } from "./user";

export const appRouter = router({
  transactions: transactionsRouter,
  accounts: accountsRouter,
  categories: categoriesRouter,
  budgets: budgetsRouter,
  ledgers: ledgersRouter,
  analytics: analyticsRouter,
  ai: aiRouter,
  import: importRouter,
  auth: authRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

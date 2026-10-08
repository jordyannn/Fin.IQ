import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/router/root";

export const trpc = createTRPCReact<AppRouter>();

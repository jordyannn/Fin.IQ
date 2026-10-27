import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@finiq/shared": path.resolve(__dirname, "./packages/shared/src"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

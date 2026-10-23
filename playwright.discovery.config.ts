import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "discovery-store.spec.ts",
  workers: 1,
  outputDir: "./test-results/discovery",
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
  reporter: "list",
});

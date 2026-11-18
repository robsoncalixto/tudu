import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// The app under test stores its tasks in a throwaway folder, never in ./data.
const dataDir = process.env.TUDU_E2E_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), "tudu-e2e-"));
process.env.TUDU_E2E_DATA_DIR = dataDir;

// Optional: run against Postgres instead of the JSON file. Every test deletes
// all tasks, so only a database whose name says it is for tests is accepted.
const databaseUrl = process.env.TUDU_E2E_DATABASE_URL ?? "";
if (databaseUrl && !/test|e2e/i.test(new URL(databaseUrl).pathname)) {
  throw new Error("TUDU_E2E_DATABASE_URL must name a throwaway database (its name must contain 'test' or 'e2e').");
}

export default defineConfig({
  testDir: "./e2e",
  // Every test resets the shared task file, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-US",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [{
    command: "node scripts/ai-test-server.mjs",
    url: "http://127.0.0.1:3120/health",
    env: { TUDU_AI_TEST_PORT: "3120" },
    reuseExistingServer: false,
  }, {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATA_DIR: dataDir,
      // Always set, so a DATABASE_URL in .env never sends tests to real data.
      DATABASE_URL: databaseUrl,
      // Provider HTTP is local; browser capture requests are mocked per test.
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      OPENAI_API_KEY: "tudu-e2e-openai-key",
      OPENAI_BASE_URL: "http://127.0.0.1:3120/v1",
      OPENROUTER_API_KEY: "",
      TUDU_AI_MODEL: "",
      TUDU_OPENAI_MODEL: "",
      TUDU_OPENROUTER_MODEL: "",
      TUDU_MCP_TOKEN: "tudu-e2e-token-not-a-production-secret",
      TUDU_MCP_ALLOWED_ORIGINS: `http://tudu.localhost:${PORT},http://client.localhost:${PORT}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  }],
});

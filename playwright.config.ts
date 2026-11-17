import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// The app under test stores its tasks in a throwaway folder, never in ./data.
const dataDir = process.env.TUDU_E2E_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), "tudu-e2e-"));
process.env.TUDU_E2E_DATA_DIR = dataDir;

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
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATA_DIR: dataDir,
      // The real AI is never called; the capture endpoints are mocked per test.
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});

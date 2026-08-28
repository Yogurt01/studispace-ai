import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// The server resolves its port from .env through dotenv; this config must read
// the same file, or the two disagree about where the app is. That divergence is
// invisible on a machine that has a .env and only shows up in CI, which has none.
dotenv.config();

/**
 * Two deliberately separate suites:
 *
 * - `ci`      — hermetic. Stubs every backend call, needs no Firebase account,
 *               no Gemini quota, no Ollama and no GPU. This is what CI runs.
 * - `local`   — full integration against a real Firebase account and a running
 *               Ollama/Qwen3. Never run in CI; see docs/LOCAL_DEVELOPMENT.md.
 */
// Same resolution order as server.ts, so the harness follows the app rather than
// asserting a port of its own. 8080 is the container default (Cloud Run's), and a
// local .env with PORT=3000 moves both together.
const PORT = Number(process.env.E2E_PORT || process.env.PORT || 8080);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Qwen3 answers on modest hardware take tens of seconds.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "ci", testDir: "./e2e/ci", use: { ...devices["Desktop Chrome"] } },
    { name: "local", testDir: "./e2e/local", use: { ...devices["Desktop Chrome"] } },
  ],
  // Reuse a dev server that is already up locally; start one in CI.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});

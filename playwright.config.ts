import { defineConfig, devices } from "@playwright/test";

/**
 * Two deliberately separate suites:
 *
 * - `ci`      — hermetic. Stubs every backend call, needs no Firebase account,
 *               no Gemini quota, no Ollama and no GPU. This is what CI runs.
 * - `local`   — full integration against a real Firebase account and a running
 *               Ollama/Qwen3. Never run in CI; see docs/LOCAL_DEVELOPMENT.md.
 */
const PORT = Number(process.env.E2E_PORT || 3000);
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

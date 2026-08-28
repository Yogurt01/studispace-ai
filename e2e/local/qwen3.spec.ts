import { expect, Page, test } from "@playwright/test";

/**
 * Full integration journey. Requires, on this machine:
 *   - a real Firebase account in E2E_EMAIL / E2E_PASSWORD
 *   - Ollama running with the configured model (`ollama serve`, `ollama pull qwen3:4b`)
 *   - DEVELOPER_MODE_PASSWORD set, since Qwen3 Local is a developer-only model
 *
 * Never run in CI. See docs/LOCAL_DEVELOPMENT.md:
 *   npm run test:e2e:local
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const DEVELOPER_PASSWORD = process.env.DEVELOPER_MODE_PASSWORD;

test.skip(!EMAIL || !PASSWORD || !DEVELOPER_PASSWORD, "E2E_EMAIL / E2E_PASSWORD / DEVELOPER_MODE_PASSWORD are not set");

async function signIn(page: Page) {
  await page.goto("/");
  const alreadyIn = page.locator("#nav-tab-socrates_ai");
  const signInTab = page.locator("#tab-auth-signin");
  await Promise.race([
    alreadyIn.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {}),
    signInTab.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {}),
  ]);
  if (await alreadyIn.isVisible().catch(() => false)) return;

  await signInTab.click();
  await page.locator('input[type="email"]').fill(EMAIL!);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator("#btn-auth-submit").click();
  await expect(page.locator("#nav-tab-socrates_ai")).toBeVisible({ timeout: 45_000 });
}

/**
 * Unlocks Developer Mode through the real dialog, which is the only way to reach
 * Qwen3 Local: it is a developer-tier model and the server enforces that.
 */
async function unlockDeveloperMode(page: Page) {
  if (await page.locator("#badge-developer-mode").isVisible().catch(() => false)) return;
  await page.locator("#btn-model-qwen3-local").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#input-developer-password").fill(DEVELOPER_PASSWORD!);
  await page.locator("#btn-developer-unlock").click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("#badge-developer-mode")).toBeVisible();
}

async function openFreshThread(page: Page) {
  await page.locator("#nav-tab-socrates_ai").click();
  await expect(page.locator("#btn-chat-send")).toBeVisible();
  const clear = page.getByRole("button", { name: /^Clear$/ });
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
    await page.waitForTimeout(2000);
  }
}

async function ask(page: Page, question: string) {
  const before = await page.locator("text=Read Out Loud").count();
  await page.locator('input[type="text"]').fill(question);
  await page.locator("#btn-chat-send").click();
  // Generation is visible first, then one more answer toolbar than before.
  await expect(page.getByText(/Analyzing via/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Analyzing via/i)).toBeHidden({ timeout: 170_000 });
  await expect(page.locator("text=Read Out Loud")).toHaveCount(before + 1, { timeout: 20_000 });
}

test("signs in, gets a real Qwen3 answer, follows up in context, and survives a reload", async ({ page }) => {
  await signIn(page);

  // Qwen3 must be unlocked and detected as available before anything is sent.
  const localButton = page.locator("#btn-model-qwen3-local");
  await page.locator("#nav-tab-socrates_ai").click();
  await expect(localButton).toBeVisible({ timeout: 30_000 });
  await unlockDeveloperMode(page);
  await expect(localButton).not.toContainText(/Offline/i);
  await localButton.click();

  await openFreshThread(page);
  await localButton.click();

  await ask(page, "What is binary search?");
  const firstAnswer = await page.locator("body").innerText();
  expect(firstAnswer).toMatch(/binary search|sorted|middle|half/i);
  // Qwen3's private reasoning must never reach the transcript.
  expect(firstAnswer).not.toContain("</think>");
  expect(firstAnswer).not.toContain("<think>");

  await ask(page, "Why is its time complexity O(log n)?");
  const followUp = await page.locator("body").innerText();
  // The follow-up says "its", so a correct answer needs the previous turn.
  expect(followUp).toMatch(/half|halv|log|divide/i);
  expect(followUp).not.toContain("</think>");

  // Conversation survives a full reload.
  await page.reload();
  await expect(page.locator("#nav-tab-socrates_ai")).toBeVisible({ timeout: 45_000 });
  await page.locator("#nav-tab-socrates_ai").click();
  await expect(page.getByText("What is binary search?")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Why is its time complexity O(log n)?")).toBeVisible();
});

test("a failed turn leaves no fabricated assistant message behind after reload", async ({ page }) => {
  await signIn(page);
  await openFreshThread(page);

  // Force a server-side failure for one turn only.
  await page.route("**/api/socrates/chat", (route) =>
    route.fulfill({ status: 502, json: { error: "Qwen3 Local could not complete this answer.", provider: "ollama", reason: "generation_failed" } })
  );
  await page.locator('input[type="text"]').fill("This turn is meant to fail.");
  await page.locator("#btn-chat-send").click();
  await expect(page.getByText(/could not complete this answer/i)).toBeVisible({ timeout: 30_000 });

  await page.unroute("**/api/socrates/chat");
  await page.reload();
  await expect(page.locator("#nav-tab-socrates_ai")).toBeVisible({ timeout: 45_000 });
  await page.locator("#nav-tab-socrates_ai").click();
  await page.waitForTimeout(4000);

  const afterReload = await page.locator("body").innerText();
  // Neither the failed question nor the error notice may be persisted.
  expect(afterReload).not.toContain("This turn is meant to fail.");
  expect(afterReload).not.toMatch(/Socrates couldn't answer that one/i);
});

test("every tutoring mode reaches the model and produces an answer", async ({ page }) => {
  test.setTimeout(900_000);
  await signIn(page);
  await openFreshThread(page);
  await unlockDeveloperMode(page);
  await page.locator("#btn-model-qwen3-local").click();

  const modes: Array<[RegExp, string]> = [
    [/Socratic Guide/i, "I don't understand binary search."],
    [/ELI5 Simplified/i, "Explain binary search."],
    [/Exam Griller/i, "Test me on binary search."],
    [/Mnemonic Master/i, "Help me remember the binary search conditions."],
    [/Essay Roaster/i, "Roast this thesis: binary search is always faster than linear search."],
  ];
  for (const [label, question] of modes) {
    await page.getByRole("button", { name: label }).click();
    await ask(page, question);
  }
  const transcript = await page.locator("body").innerText();
  expect(transcript).not.toContain("</think>");
});

test("logging out returns to the login screen and logging back in restores the session", async ({ page }) => {
  await signIn(page);
  await page.locator("#btn-header-logout").click();
  await expect(page.locator("#tab-auth-signin")).toBeVisible({ timeout: 30_000 });

  await page.locator('input[type="email"]').fill(EMAIL!);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator("#btn-auth-submit").click();
  await expect(page.locator("#nav-tab-socrates_ai")).toBeVisible({ timeout: 45_000 });
});

test("invalid credentials are rejected with a safe message", async ({ page }) => {
  await page.goto("/");
  const logout = page.locator("#btn-header-logout");
  if (await logout.isVisible().catch(() => false)) {
    await logout.click();
    await expect(page.locator("#tab-auth-signin")).toBeVisible({ timeout: 30_000 });
  }
  await page.locator("#tab-auth-signin").click();
  await page.locator('input[type="email"]').fill(EMAIL!);
  await page.locator('input[type="password"]').fill("definitely-the-wrong-password");
  await page.locator("#btn-auth-submit").click();
  await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 30_000 });
});

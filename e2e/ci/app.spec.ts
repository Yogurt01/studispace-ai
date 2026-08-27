import { expect, test } from "@playwright/test";

/**
 * Hermetic browser tests. Every backend call is stubbed, so these need no
 * Firebase account, no Gemini quota, no Ollama and no GPU — they are safe for CI.
 * The full authenticated Qwen3 journey lives in e2e/local.
 */

test("the application loads and serves its health endpoint", async ({ page, request }) => {
  const health = await request.get("/health");
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toEqual({ status: "ok" });

  await page.goto("/");
  await expect(page).toHaveTitle(/StudiSpace|AI Studio App/i);
});

test("runtime Firebase configuration is served without server secrets", async ({ request }) => {
  const res = await request.get("/runtime-config.js");
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  // Browser-safe Firebase identifiers only.
  expect(body).toContain("__STUDISPACE_RUNTIME_CONFIG__");
  expect(body).not.toMatch(/GEMINI_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|private_key/);
});

test("the provider endpoint never leaks keys or internal URLs", async ({ request }) => {
  const res = await request.get("/api/ai/providers");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.providers)).toBeTruthy();
  for (const provider of body.providers) {
    expect(provider).toHaveProperty("id");
    expect(provider).toHaveProperty("name");
    expect(provider).toHaveProperty("available");
  }
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/AIza|apiKey|11434|service_account/);
});

test("the unauthenticated visitor lands on the login screen", async ({ page }) => {
  await page.goto("/");
  // Auth state must resolve; the app must not hang on its loading gate.
  await expect(page.getByRole("button", { name: /Instant Demo Mode/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#tab-auth-signin")).toBeVisible();
  await expect(page.locator("#tab-auth-signup")).toBeVisible();
});

test("switching to sign-up reveals the registration fields", async ({ page }) => {
  await page.goto("/");
  await page.locator("#tab-auth-signup").click();
  await expect(page.getByRole("heading", { name: /JOIN STUDISPACE/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Alex Nguyen/i)).toBeVisible();
});

test("sign-up rejects a password shorter than six characters before calling Firebase", async ({ page }) => {
  await page.goto("/");
  await page.locator("#tab-auth-signup").click();
  await page.locator('input[type="email"]').fill("studispace.e2e@example.com");
  await page.locator('input[type="password"]').fill("abc");
  await page.locator("#btn-auth-submit").click();
  await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
});

test("an invalid email is blocked by the form before submission", async ({ page }) => {
  await page.goto("/");
  await page.locator("#tab-auth-signup").click();
  const email = page.locator('input[type="email"]');
  await email.fill("not-an-email");
  await page.locator('input[type="password"]').fill("StrongPass123");
  await page.locator("#btn-auth-submit").click();
  // Native constraint validation keeps the form from submitting.
  expect(await email.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
});

test("guest mode reaches the authenticated shell and opens Socrates AI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Instant Demo Mode/i }).click();
  await expect(page.locator("#nav-tab-socrates_ai")).toBeVisible({ timeout: 30_000 });
  await page.locator("#nav-tab-socrates_ai").click();
  await expect(page.locator("#btn-chat-send")).toBeVisible();
});

test("an offline local runtime is disabled in the UI and never sent a request", async ({ page }) => {
  // Stub availability so the test does not depend on a real Ollama process.
  await page.route("**/api/ai/providers", (route) =>
    route.fulfill({
      json: {
        providers: [
          { id: "gemini", name: "Gemini", isDefault: true, available: true, model: "gemini-3.7-flash" },
          { id: "ollama", name: "Qwen3 Local", isDefault: false, available: false, model: "qwen3:4b", detail: "Ollama is not reachable." },
        ],
        defaultProvider: "gemini",
      },
    })
  );
  let chatRequests = 0;
  await page.route("**/api/socrates/chat", (route) => {
    chatRequests += 1;
    return route.fulfill({ json: { reply: "should never be called" } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Instant Demo Mode/i }).click();
  await page.locator("#nav-tab-socrates_ai").click();

  const localButton = page.locator("#btn-model-ollama");
  await expect(localButton).toContainText(/Offline/i);
  await expect(localButton).toBeDisabled();
  expect(chatRequests).toBe(0);
});

test("a provider failure shows a student-facing message and no stack trace", async ({ page }) => {
  await page.route("**/api/ai/providers", (route) =>
    route.fulfill({
      json: {
        providers: [{ id: "ollama", name: "Qwen3 Local", isDefault: true, available: true, model: "qwen3:4b" }],
        defaultProvider: "ollama",
      },
    })
  );
  await page.route("**/api/socrates/chat", (route) =>
    route.fulfill({ status: 503, json: { error: "Qwen3 Local is offline. Please start Ollama and try again.", provider: "ollama", reason: "offline" } })
  );

  await page.goto("/");
  await page.getByRole("button", { name: /Instant Demo Mode/i }).click();
  await page.locator("#nav-tab-socrates_ai").click();
  await page.locator('input[type="text"]').fill("What is binary search?");
  await page.locator("#btn-chat-send").click();

  await expect(page.getByText(/Please start Ollama and try again/i)).toBeVisible();
  // No internal detail leaks into the transcript.
  await expect(page.locator("body")).not.toContainText(/\.ts:\d+|at Object\.|ProviderError:/);
});

test("the selected tutoring mode is what the client sends", async ({ page }) => {
  await page.route("**/api/ai/providers", (route) =>
    route.fulfill({
      json: {
        providers: [{ id: "ollama", name: "Qwen3 Local", isDefault: true, available: true, model: "qwen3:4b" }],
        defaultProvider: "ollama",
      },
    })
  );
  const sent: Array<{ mode: string; provider: string; threadId: string }> = [];
  await page.route("**/api/socrates/chat", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: "stubbed reply", mode: "eli5", threadId: "t", provider: "ollama" } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Instant Demo Mode/i }).click();
  await page.locator("#nav-tab-socrates_ai").click();
  await page.getByRole("button", { name: /ELI5 Simplified/i }).click();
  await page.locator('input[type="text"]').fill("Explain binary search.");
  await page.locator("#btn-chat-send").click();

  await expect(page.getByText("stubbed reply")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0].mode).toBe("eli5");
  expect(sent[0].provider).toBe("ollama");
  // Identity is never taken from the body.
  expect(sent[0]).not.toHaveProperty("userId");
});

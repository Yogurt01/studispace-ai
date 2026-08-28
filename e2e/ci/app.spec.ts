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

test("the model endpoint offers exactly three models and leaks no secrets", async ({ request }) => {
  const res = await request.get("/api/ai/models");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.models.map((m: any) => m.id)).toEqual(["gemini-2.5-flash", "gemini-3.7-flash", "qwen3-local"]);
  expect(body.models.map((m: any) => m.tier)).toEqual(["free", "developer", "developer"]);
  // An unauthorized caller sees both developer models locked, and the free one open.
  expect(body.models.map((m: any) => m.locked)).toEqual([false, true, true]);
  expect(body.defaultModel).toBe("gemini-2.5-flash");
  expect(body.developerMode.unlocked).toBe(false);
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/AIza|apiKey|11434|service_account|DEVELOPER_MODE_PASSWORD/);
});

test("the backend refuses a developer model to a caller with no developer token", async ({ request }) => {
  // Straight at the API, bypassing the UI entirely — the padlock is not the lock.
  for (const model of ["gemini-3.7-flash", "qwen3-local"]) {
    const res = await request.post("/api/socrates/chat", {
      data: { threadId: `direct-${model}`, message: "Answer me anyway.", mode: "socratic", model },
    });
    expect(res.status(), `${model} must be refused`).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("developer_mode_required");
    expect(JSON.stringify(body)).not.toMatch(/password/i);
  }

  // The same bypass through the legacy runtime-shaped field is refused too.
  const legacy = await request.post("/api/socrates/chat", {
    data: { threadId: "direct-legacy", message: "Answer me anyway.", mode: "socratic", provider: "ollama" },
  });
  expect(legacy.status()).toBe(403);

  // A forged token is not a token.
  const forged = await request.post("/api/socrates/chat", {
    headers: { "X-Developer-Token": "v1.eyJleHAiOjk5OTk5OTk5OTk5OTl9.not-a-real-signature" },
    data: { threadId: "direct-forged", message: "Answer me anyway.", mode: "socratic", model: "qwen3-local" },
  });
  expect(forged.status()).toBe(403);
});

test("an unknown model id is rejected before anything is routed", async ({ request }) => {
  const res = await request.post("/api/socrates/chat", {
    data: { threadId: "unknown-model", message: "hi", mode: "socratic", model: "gemini-9-omega" },
  });
  expect(res.status()).toBe(400);
});

test("a wrong developer password is refused and yields no token", async ({ request }) => {
  const res = await request.post("/api/developer/unlock", { data: { password: "definitely-not-the-password" } });
  // 401 when a password is configured, 503 when this server has none. Either way
  // the one thing that must never happen is a token coming back.
  expect([401, 503]).toContain(res.status());
  expect(await res.json()).not.toHaveProperty("token");
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

/** Availability stub: three models, both developer ones locked unless stated. */
function stubModels(page: import("@playwright/test").Page, overrides: Record<string, any> = {}, unlocked = false) {
  return page.route("**/api/ai/models", (route) => {
    // Mirror the server: a developer token in the request is what clears the
    // locks. A stub that ignored the header would hide a real regression.
    const authorized = unlocked || Boolean(route.request().headers()["x-developer-token"]);
    return route.fulfill({
      json: {
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "free", isDefault: true, available: true, locked: false, model: "gemini-2.5-flash", ...overrides["gemini-2.5-flash"] },
          { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", tier: "developer", isDefault: false, available: true, locked: !authorized, model: "gemini-3.7-flash", ...overrides["gemini-3.7-flash"] },
          { id: "qwen3-local", name: "Qwen3 Local", tier: "developer", isDefault: false, available: true, locked: !authorized, model: "qwen3:4b", ...overrides["qwen3-local"] },
        ],
        defaultModel: "gemini-2.5-flash",
        developerMode: { configured: true, unlocked: authorized },
      },
    });
  });
}

async function openSocrates(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Instant Demo Mode/i }).click();
  await page.locator("#nav-tab-socrates_ai").click();
  await expect(page.locator("#btn-chat-send")).toBeVisible();
}

test("the selector shows three distinct models with Gemini 2.5 Flash selected by default", async ({ page }) => {
  await stubModels(page);
  await openSocrates(page);

  const free = page.locator("#btn-model-gemini-2-5-flash");
  const hosted = page.locator("#btn-model-gemini-3-7-flash");
  const local = page.locator("#btn-model-qwen3-local");

  await expect(free).toContainText(/Gemini 2\.5 Flash/i);
  await expect(hosted).toContainText(/Gemini 3\.7 Flash/i);
  await expect(local).toContainText(/Qwen3 Local/i);

  // The free model is the active one, and it needs no unlocking.
  await expect(free).toHaveAttribute("aria-pressed", "true");
  await expect(hosted).toHaveAttribute("aria-pressed", "false");
  await expect(local).toHaveAttribute("aria-pressed", "false");

  // Both developer models are visibly locked and labelled as such.
  await expect(hosted).toContainText("🔒");
  await expect(local).toContainText("🔒");
  await expect(hosted).toContainText(/DEV/i);
  await expect(free).not.toContainText("🔒");
});

test("clicking a locked model opens the password prompt, and cancelling leaves it locked", async ({ page }) => {
  await stubModels(page);
  await openSocrates(page);

  for (const id of ["gemini-3-7-flash", "qwen3-local"]) {
    await page.locator(`#btn-model-${id}`).click();
    // The same prompt for both locked models.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Developer Mode/i })).toBeVisible();
    // The field must never show what is typed.
    await expect(page.locator("#input-developer-password")).toHaveAttribute("type", "password");

    await page.locator("#btn-developer-cancel").click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // Cancelling selects nothing: the free model is still the active one.
    await expect(page.locator(`#btn-model-${id}`)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#btn-model-gemini-2-5-flash")).toHaveAttribute("aria-pressed", "true");
  }
});

test("a wrong password is reported and the model stays locked", async ({ page }) => {
  await stubModels(page);
  await page.route("**/api/developer/unlock", (route) =>
    route.fulfill({ status: 401, json: { error: "Incorrect developer password." } })
  );
  await openSocrates(page);

  await page.locator("#btn-model-qwen3-local").click();
  await page.locator("#input-developer-password").fill("wrong-password");
  // Enter submits, as a password field should.
  await page.locator("#input-developer-password").press("Enter");

  await expect(page.getByRole("alert")).toContainText(/Incorrect developer password/i);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#btn-model-qwen3-local")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#badge-developer-mode")).toHaveCount(0);
});

test("the correct password unlocks the developer models and selects the one clicked", async ({ page }) => {
  await stubModels(page);
  await page.route("**/api/developer/unlock", (route) =>
    route.fulfill({ json: { ok: true, token: "v1.stub-payload.stub-signature", expiresAt: Date.now() + 3_600_000 } })
  );
  const sent: Array<Record<string, any>> = [];
  await page.route("**/api/socrates/chat", async (route) => {
    sent.push({ body: route.request().postDataJSON(), token: route.request().headers()["x-developer-token"] });
    await route.fulfill({ json: { reply: "unlocked reply", mode: "socratic", threadId: "t", model: "qwen3-local" } });
  });
  await openSocrates(page);

  await page.locator("#btn-model-qwen3-local").click();
  await page.locator("#input-developer-password").fill("the-right-password");
  await page.locator("#btn-developer-unlock").click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#badge-developer-mode")).toBeVisible();
  const local = page.locator("#btn-model-qwen3-local");
  await expect(local).toHaveAttribute("aria-pressed", "true");
  await expect(local).not.toContainText("🔒");

  // The unlocked model is what the next message is actually sent with, and the
  // token rides along for the server to check again.
  await page.locator('input[type="text"]').fill("Explain gradient descent.");
  await page.locator("#btn-chat-send").click();
  await expect(page.getByText("unlocked reply")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0].body.model).toBe("qwen3-local");
  expect(sent[0].token).toBe("v1.stub-payload.stub-signature");
  // The password itself never appears in any request the browser makes.
  expect(JSON.stringify(sent[0])).not.toContain("the-right-password");
});

test("an offline local runtime is disabled in the UI and never sent a request", async ({ page }) => {
  // Unlocked, so the only thing standing in the way is Ollama being down.
  await stubModels(page, { "qwen3-local": { available: false, locked: false, detail: "Ollama is not reachable." } }, true);
  let chatRequests = 0;
  await page.route("**/api/socrates/chat", (route) => {
    chatRequests += 1;
    return route.fulfill({ json: { reply: "should never be called" } });
  });

  await openSocrates(page);

  const localButton = page.locator("#btn-model-qwen3-local");
  await expect(localButton).toContainText(/Offline/i);
  await expect(localButton).toBeDisabled();
  expect(chatRequests).toBe(0);
});

test("a provider failure shows a student-facing message and no stack trace", async ({ page }) => {
  await stubModels(page);
  await page.route("**/api/socrates/chat", (route) =>
    route.fulfill({ status: 503, json: { error: "Qwen3 Local is offline. Please start Ollama and try again.", provider: "ollama", reason: "offline" } })
  );

  await openSocrates(page);
  await page.locator('input[type="text"]').fill("What is binary search?");
  await page.locator("#btn-chat-send").click();

  await expect(page.getByText(/Please start Ollama and try again/i)).toBeVisible();
  // No internal detail leaks into the transcript.
  await expect(page.locator("body")).not.toContainText(/\.ts:\d+|at Object\.|ProviderError:/);
});

test("the selected tutoring mode is what the client sends", async ({ page }) => {
  await stubModels(page);
  const sent: Array<{ mode: string; model: string; threadId: string }> = [];
  await page.route("**/api/socrates/chat", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: "stubbed reply", mode: "eli5", threadId: "t", model: "gemini-2.5-flash" } });
  });

  await openSocrates(page);
  await page.getByRole("button", { name: /ELI5 Simplified/i }).click();
  await page.locator('input[type="text"]').fill("Explain binary search.");
  await page.locator("#btn-chat-send").click();

  await expect(page.getByText("stubbed reply")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0].mode).toBe("eli5");
  // The free default is what a normal student sends, named explicitly.
  expect(sent[0].model).toBe("gemini-2.5-flash");
  // Identity is never taken from the body.
  expect(sent[0]).not.toHaveProperty("userId");
});

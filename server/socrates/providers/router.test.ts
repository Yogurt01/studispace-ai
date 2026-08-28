import assert from "node:assert/strict";
import test from "node:test";
import { createProviderRouter, DEFAULT_MODEL_ID, geminiDisplayName, resolveEnabledProviders } from "./index";
import { GeminiProvider, nextQuotaResetAt } from "./gemini";
import { ProviderRouter } from "./router";
import { StubProvider } from "./testing";
import { AI_MODEL_IDS, isAiModelId, isModelProviderId, ModelAccessError, ProviderError } from "./types";

const DEVELOPER = { developer: true };

function freeAndLocked() {
  const free = new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash");
  const hosted = new StubProvider("gemini-3.7-flash", "Gemini 3.7 Flash", { tier: "developer" });
  const local = new StubProvider("qwen3-local", "Qwen3 Local", { tier: "developer" });
  return { free, hosted, local, router: new ProviderRouter([free, hosted, local], "gemini-2.5-flash") };
}

test("routes each model id to its own provider and falls back to the free default", async () => {
  const { router } = freeAndLocked();
  assert.equal(router.resolve("gemini-2.5-flash").id, "gemini-2.5-flash");
  assert.equal(router.resolve("gemini-3.7-flash", DEVELOPER).id, "gemini-3.7-flash");
  assert.equal(router.resolve("qwen3-local", DEVELOPER).id, "qwen3-local");
  assert.equal(router.resolve(undefined).id, "gemini-2.5-flash");
  assert.equal(router.defaultId, "gemini-2.5-flash");
});

test("a developer-only model is refused without proven developer access", () => {
  const { router } = freeAndLocked();
  for (const id of ["gemini-3.7-flash", "qwen3-local"] as const) {
    const err = (() => { try { router.resolve(id); } catch (e) { return e; } })();
    assert.ok(err instanceof ModelAccessError, `${id} must be refused for a normal user`);
    assert.equal(err.modelId, id);
    // Refusal is explicit about the tier and names no secret.
    assert.match(err.message, /Developer Mode/i);
  }
  // ...and the same ids resolve once developer access is proven.
  assert.equal(router.resolve("gemini-3.7-flash", DEVELOPER).id, "gemini-3.7-flash");
  assert.equal(router.resolve("qwen3-local", DEVELOPER).id, "qwen3-local");
});

test("the free model needs no developer access", () => {
  const { router } = freeAndLocked();
  assert.equal(router.resolve("gemini-2.5-flash").tier, "free");
  assert.equal(router.resolve("gemini-2.5-flash", { developer: false }).id, "gemini-2.5-flash");
});

test("refuses to construct with an unregistered or locked default", () => {
  const free = new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash");
  const locked = new StubProvider("qwen3-local", "Qwen3 Local", { tier: "developer" });
  assert.throws(() => new ProviderRouter([free], "qwen3-local"), /not registered/);
  // A developer-tier default would greet every student with a locked model.
  assert.throws(() => new ProviderRouter([free, locked], "qwen3-local"), /must be free-tier/);
});

test("resolving an unregistered model raises a provider error, not a crash", () => {
  const router = new ProviderRouter([new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash")], "gemini-2.5-flash");
  const err = (() => { try { router.resolve("qwen3-local"); } catch (e) { return e; } })();
  assert.ok(err instanceof ProviderError);
  assert.equal(err.reason, "not_configured");
});

test("describes every model with availability, tier and lock state, and no secrets", async () => {
  const router = new ProviderRouter(
    [
      new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash", { availability: { available: true, model: "gemini-2.5-flash" } }),
      new StubProvider("gemini-3.7-flash", "Gemini 3.7 Flash", { tier: "developer", availability: { available: true, model: "gemini-3.7-flash" } }),
      new StubProvider("qwen3-local", "Qwen3 Local", { tier: "developer", availability: { available: false, model: "qwen3:4b", detail: "Ollama is not reachable." } }),
    ],
    "gemini-2.5-flash"
  );

  const asStudent = await router.describeAll();
  assert.deepEqual(asStudent.map((m) => m.id), ["gemini-2.5-flash", "gemini-3.7-flash", "qwen3-local"]);
  assert.deepEqual(asStudent.map((m) => m.locked), [false, true, true]);
  assert.deepEqual(asStudent.map((m) => m.tier), ["free", "developer", "developer"]);
  assert.equal(asStudent[0].isDefault, true);
  assert.equal(asStudent[2].available, false);

  const asDeveloper = await router.describeAll(DEVELOPER);
  assert.deepEqual(asDeveloper.map((m) => m.locked), [false, false, false]);
  // Availability is independent of the lock: an offline runtime stays offline.
  assert.equal(asDeveloper[2].available, false);

  // Nothing in either payload may carry a key, a URL or the developer password.
  const serialized = JSON.stringify([asStudent, asDeveloper]);
  assert.doesNotMatch(serialized, /apiKey|AIza|localhost:11434|password/i);
});

test("a provider whose availability check throws is reported unavailable, not fatal", async () => {
  const exploding = new StubProvider("qwen3-local", "Qwen3 Local", { tier: "developer" });
  exploding.checkAvailability = async () => { throw new Error("boom"); };
  const router = new ProviderRouter([new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash"), exploding], "gemini-2.5-flash");
  const described = await router.describeAll();
  assert.equal(described.find((m) => m.id === "qwen3-local")?.available, false);
});

test("builds all three models from environment configuration", async () => {
  const router = createProviderRouter({ GEMINI_API_KEY: "test-key", OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "qwen3:4b" } as NodeJS.ProcessEnv);
  const described = await router.describeAll();
  assert.deepEqual(described.map((m) => m.id), ["gemini-2.5-flash", "gemini-3.7-flash", "qwen3-local"]);
  assert.deepEqual(described.map((m) => m.name), ["Gemini 2.5 Flash", "Gemini 3.7 Flash", "Qwen3 Local"]);
  assert.deepEqual(described.map((m) => m.tier), ["free", "developer", "developer"]);
});

test("the two Gemini options are distinct models, not one relabelled twice", async () => {
  const router = createProviderRouter({ GEMINI_API_KEY: "test-key" } as NodeJS.ProcessEnv);
  const free = await router.resolve("gemini-2.5-flash").checkAvailability();
  const hosted = await router.resolve("gemini-3.7-flash", DEVELOPER).checkAvailability();
  assert.equal(free.model, "gemini-2.5-flash");
  assert.equal(hosted.model, "gemini-3.7-flash");
  assert.notEqual(free.model, hosted.model);
});

test("GEMINI_MODEL overrides only the developer-tier Gemini option", async () => {
  const router = createProviderRouter({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.6-flash" } as NodeJS.ProcessEnv);
  assert.equal((await router.resolve("gemini-3.7-flash", DEVELOPER).checkAvailability()).model, "gemini-3.6-flash");
  // The free tier must not follow it — that is the mapping this design removes.
  assert.equal((await router.resolve("gemini-2.5-flash").checkAvailability()).model, "gemini-2.5-flash");
});

test("an overridden model relabels its button, so the UI never names the wrong one", async () => {
  const overridden = createProviderRouter({
    GEMINI_API_KEY: "k",
    GEMINI_FREE_MODEL: "gemini-3.5-flash",
    GEMINI_DEVELOPER_MODEL: "gemini-3.6-flash",
  } as NodeJS.ProcessEnv);
  const described = await overridden.describeAll(DEVELOPER);
  assert.equal(described[0].name, "Gemini 3.5 Flash");
  assert.equal(described[0].model, "gemini-3.5-flash");
  assert.equal(described[1].name, "Gemini 3.6 Flash");
  assert.equal(described[1].model, "gemini-3.6-flash");
  // The free slot stays free and default even when it serves another model.
  assert.equal(described[0].tier, "free");
  assert.equal(described[0].isDefault, true);

  assert.equal(geminiDisplayName("gemini-2.5-flash"), "Gemini 2.5 Flash");
  assert.equal(geminiDisplayName("gemini-3.7-flash"), "Gemini 3.7 Flash");
});

test("the default model is the free one and cannot be configured into a locked one", () => {
  assert.equal(createProviderRouter({} as NodeJS.ProcessEnv).defaultId, DEFAULT_MODEL_ID);
  assert.equal(DEFAULT_MODEL_ID, "gemini-2.5-flash");
  // Legacy configuration that used to move the default has no say any more.
  assert.equal(createProviderRouter({ DEFAULT_AI_PROVIDER: "ollama" } as NodeJS.ProcessEnv).defaultId, "gemini-2.5-flash");
});

test("gemini availability follows key configuration without spending quota", async () => {
  const configured = createProviderRouter({ GEMINI_API_KEY: "test-key" } as NodeJS.ProcessEnv);
  assert.equal((await configured.resolve("gemini-2.5-flash").checkAvailability()).available, true);
  const unconfigured = createProviderRouter({} as NodeJS.ProcessEnv);
  const missing = await unconfigured.resolve("gemini-2.5-flash").checkAvailability();
  assert.equal(missing.available, false);
  assert.match(missing.detail ?? "", /GEMINI_API_KEY/);
});

test("only known ids are accepted from client input", () => {
  assert.equal(isAiModelId("gemini-2.5-flash"), true);
  assert.equal(isAiModelId("gemini-3.7-flash"), true);
  assert.equal(isAiModelId("qwen3-local"), true);
  assert.equal(isAiModelId("gemini-4-ultra"), false);
  assert.equal(isAiModelId(undefined), false);
  assert.equal(isModelProviderId("gemini"), true);
  assert.equal(isModelProviderId("openai"), false);
});

test("AI_PROVIDERS decides which runtimes work, never how many models are listed", async () => {
  // A cloud deployment has no local Ollama. The option stays visible and honest
  // rather than disappearing, so the selector does not change shape per host.
  const cloud = createProviderRouter({ AI_PROVIDERS: "gemini", GEMINI_API_KEY: "k" } as NodeJS.ProcessEnv);
  const described = await cloud.describeAll({ developer: true });
  assert.deepEqual(described.map((m) => m.id), [...AI_MODEL_IDS]);
  const qwen = described.find((m) => m.id === "qwen3-local");
  assert.equal(qwen?.available, false);
  assert.match(qwen?.detail ?? "", /not enabled/i);

  // ...and a disabled runtime refuses to generate even for a developer.
  await assert.rejects(
    () => cloud.resolve("qwen3-local", DEVELOPER).generate({ systemInstruction: "s", messages: [] }),
    (err: unknown) => err instanceof ProviderError && err.reason === "not_configured"
  );

  const localOnly = createProviderRouter({ AI_PROVIDERS: "ollama" } as NodeJS.ProcessEnv);
  const geminiOff = (await localOnly.describeAll()).find((m) => m.id === "gemini-2.5-flash");
  assert.equal(geminiOff?.available, false);
});

test("unknown entries in AI_PROVIDERS are ignored", () => {
  assert.deepEqual(resolveEnabledProviders({ AI_PROVIDERS: "gemini, openai ,ollama" } as NodeJS.ProcessEnv), ["gemini", "ollama"]);
  assert.deepEqual(resolveEnabledProviders({ AI_PROVIDERS: "nonsense" } as NodeJS.ProcessEnv), ["gemini", "ollama"]);
});

test("gemini stops reporting available once its daily quota is observed as spent", async () => {
  let clock = Date.parse("2026-08-27T10:00:00Z");
  const provider = new GeminiProvider({ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "free", apiKey: "k", model: "gemini-2.5-flash", now: () => clock });
  assert.equal((await provider.checkAvailability()).available, true);

  // Stand in for the 429 the SDK raises when the free tier is exhausted. Calling
  // generate() here would make a real network request, which CI must never need.
  (provider as any).markUnavailable(nextQuotaResetAt(clock), "Gemini's daily free-tier quota is used up.");
  const spent = await provider.checkAvailability();
  assert.equal(spent.available, false);
  assert.match(spent.detail ?? "", /quota/i);

  // ...and becomes available again after the reset boundary.
  clock = nextQuotaResetAt(clock) + 1000;
  assert.equal((await provider.checkAvailability()).available, true);
});

test("the quota reset boundary is the next midnight US Pacific", () => {
  const reset = nextQuotaResetAt(Date.parse("2026-08-27T10:00:00Z"));
  assert.ok(reset > Date.parse("2026-08-27T10:00:00Z"));
  // Within 24h of the observation.
  assert.ok(reset - Date.parse("2026-08-27T10:00:00Z") <= 24 * 3600 * 1000);
});

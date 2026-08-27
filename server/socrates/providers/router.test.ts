import assert from "node:assert/strict";
import test from "node:test";
import { createProviderRouter, resolveEnabledProviders } from "./index";
import { GeminiProvider, nextQuotaResetAt } from "./gemini";
import { ProviderRouter } from "./router";
import { StubProvider } from "./testing";
import { isModelProviderId, ProviderError } from "./types";

test("routes each id to its own provider and falls back to the default", async () => {
  const gemini = new StubProvider("gemini", "Gemini");
  const ollama = new StubProvider("ollama", "Qwen3 Local");
  const router = new ProviderRouter([gemini, ollama], "gemini");

  assert.equal(router.resolve("gemini").id, "gemini");
  assert.equal(router.resolve("ollama").id, "ollama");
  assert.equal(router.resolve(undefined).id, "gemini");
  assert.equal(router.defaultId, "gemini");
});

test("refuses to construct with an unregistered default", () => {
  assert.throws(() => new ProviderRouter([new StubProvider("gemini", "Gemini")], "ollama"), /not registered/);
});

test("resolving an unregistered provider raises a provider error, not a crash", () => {
  const router = new ProviderRouter([new StubProvider("gemini", "Gemini")], "gemini");
  const err = (() => { try { router.resolve("ollama"); } catch (e) { return e; } })();
  assert.ok(err instanceof ProviderError);
  assert.equal(err.reason, "not_configured");
});

test("describes every provider with availability and no secrets", async () => {
  const router = new ProviderRouter(
    [
      new StubProvider("gemini", "Gemini", { availability: { available: true, model: "gemini-3.7-flash" } }),
      new StubProvider("ollama", "Qwen3 Local", { availability: { available: false, model: "qwen3:4b", detail: "Ollama is not reachable." } }),
    ],
    "gemini"
  );
  const described = await router.describeAll();
  assert.deepEqual(described.map((p) => p.id), ["gemini", "ollama"]);
  assert.equal(described[0].available, true);
  assert.equal(described[0].isDefault, true);
  assert.equal(described[1].available, false);
  assert.equal(described[1].name, "Qwen3 Local");
  // Nothing in the payload may carry a key or a URL.
  const serialized = JSON.stringify(described);
  assert.doesNotMatch(serialized, /apiKey|AIza|localhost:11434/);
});

test("a provider whose availability check throws is reported unavailable, not fatal", async () => {
  const exploding = new StubProvider("ollama", "Qwen3 Local");
  exploding.checkAvailability = async () => { throw new Error("boom"); };
  const router = new ProviderRouter([new StubProvider("gemini", "Gemini"), exploding], "gemini");
  const described = await router.describeAll();
  assert.equal(described.find((p) => p.id === "ollama")?.available, false);
});

test("builds both runtimes from environment configuration", async () => {
  const router = createProviderRouter({ GEMINI_API_KEY: "test-key", OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "qwen3:4b" } as NodeJS.ProcessEnv);
  assert.equal(router.resolve("gemini").name, "Gemini");
  assert.equal(router.resolve("ollama").name, "Qwen3 Local");
  assert.equal(router.defaultId, "gemini");
});

test("honours DEFAULT_AI_PROVIDER and ignores an unknown value", () => {
  assert.equal(createProviderRouter({ DEFAULT_AI_PROVIDER: "ollama" } as NodeJS.ProcessEnv).defaultId, "ollama");
  assert.equal(createProviderRouter({ DEFAULT_AI_PROVIDER: "hal9000" } as NodeJS.ProcessEnv).defaultId, "gemini");
});

test("gemini availability follows key configuration without spending quota", async () => {
  const configured = createProviderRouter({ GEMINI_API_KEY: "test-key" } as NodeJS.ProcessEnv);
  assert.equal((await configured.resolve("gemini").checkAvailability()).available, true);
  const unconfigured = createProviderRouter({} as NodeJS.ProcessEnv);
  const missing = await unconfigured.resolve("gemini").checkAvailability();
  assert.equal(missing.available, false);
  assert.match(missing.detail ?? "", /GEMINI_API_KEY/);
});

test("only known provider ids are accepted from client input", () => {
  assert.equal(isModelProviderId("gemini"), true);
  assert.equal(isModelProviderId("ollama"), true);
  assert.equal(isModelProviderId("openai"), false);
  assert.equal(isModelProviderId(undefined), false);
});

test("AI_PROVIDERS decides which runtimes a deployment offers", async () => {
  // Cloud deployments have no local Ollama; they must not advertise one.
  const cloud = createProviderRouter({ AI_PROVIDERS: "gemini", GEMINI_API_KEY: "k" } as NodeJS.ProcessEnv);
  const described = await cloud.describeAll();
  assert.deepEqual(described.map((p) => p.id), ["gemini"]);
  assert.equal(cloud.defaultId, "gemini");

  const localOnly = createProviderRouter({ AI_PROVIDERS: "ollama" } as NodeJS.ProcessEnv);
  assert.deepEqual((await localOnly.describeAll()).map((p) => p.id), ["ollama"]);

  // Unset offers both.
  assert.deepEqual((await createProviderRouter({} as NodeJS.ProcessEnv).describeAll()).map((p) => p.id), ["gemini", "ollama"]);
});

test("an unregistered DEFAULT_AI_PROVIDER falls back to an enabled runtime", () => {
  // Gemini-only deployment that still names ollama as default must not crash.
  assert.equal(createProviderRouter({ AI_PROVIDERS: "gemini", DEFAULT_AI_PROVIDER: "ollama" } as NodeJS.ProcessEnv).defaultId, "gemini");
  assert.equal(createProviderRouter({ AI_PROVIDERS: "ollama", DEFAULT_AI_PROVIDER: "ollama" } as NodeJS.ProcessEnv).defaultId, "ollama");
});

test("unknown entries in AI_PROVIDERS are ignored", () => {
  assert.deepEqual(resolveEnabledProviders({ AI_PROVIDERS: "gemini, openai ,ollama" } as NodeJS.ProcessEnv), ["gemini", "ollama"]);
  assert.deepEqual(resolveEnabledProviders({ AI_PROVIDERS: "nonsense" } as NodeJS.ProcessEnv), ["gemini", "ollama"]);
});

test("gemini stops reporting available once its daily quota is observed as spent", async () => {
  let clock = Date.parse("2026-08-27T10:00:00Z");
  const provider = new GeminiProvider({ apiKey: "k", model: "gemini-3.7-flash", now: () => clock });
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

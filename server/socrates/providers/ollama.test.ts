import assert from "node:assert/strict";
import test from "node:test";
import { OllamaConfig, OllamaProvider, stripThinking } from "./ollama";
import { ChatMessage } from "../types";
import { ProviderError } from "./types";

const config: OllamaConfig = { id: "qwen3-local", name: "Qwen3 Local", tier: "developer", baseUrl: "http://localhost:11434", model: "qwen3:4b", generateTimeoutMs: 5000, availabilityTimeoutMs: 500 };

const messages: ChatMessage[] = [
  { id: "1", userId: "u", role: "user", text: "What is supervised learning?", timestamp: "", createdAt: 1 },
  { id: "2", userId: "u", role: "model", text: "Learning from labelled data.", timestamp: "", createdAt: 2 },
  { id: "3", userId: "u", role: "user", text: "Another example?", timestamp: "", createdAt: 3 },
];

/** Minimal fetch double: records the request and replays a canned response. */
function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: any, init?: any) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("initializes from configuration and trims a trailing slash off the base URL", async () => {
  const { impl, calls } = stubFetch(() => json({ models: [{ name: "qwen3:4b" }] }));
  const provider = new OllamaProvider({ ...config, baseUrl: "http://localhost:11434/" }, impl);
  // The id is the selectable model; the runtime it speaks to is separate.
  assert.equal(provider.id, "qwen3-local");
  assert.equal(provider.runtime, "ollama");
  assert.equal(provider.name, "Qwen3 Local");
  assert.equal(provider.tier, "developer");
  await provider.checkAvailability();
  assert.equal(calls[0].url, "http://localhost:11434/api/tags");
});

test("formats the request the way the Ollama chat API expects", async () => {
  const { impl, calls } = stubFetch(() => json({ message: { role: "assistant", content: "ok" } }));
  await new OllamaProvider(config, impl).generate({ systemInstruction: "MODE: ELI5", messages, context: "Chapter 4" });

  assert.equal(calls[0].url, "http://localhost:11434/api/chat");
  assert.equal(calls[0].init?.method, "POST");
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.model, "qwen3:4b");
  assert.equal(body.stream, false);
  // Thinking stays on so Ollama keeps the trace out of `content`.
  assert.equal(body.think, true);
  // System instruction and study context are merged into the leading system turn.
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /MODE: ELI5/);
  assert.match(body.messages[0].content, /Chapter 4/);
  // StudiSpace "model" role is normalized to Ollama's "assistant".
  assert.deepEqual(body.messages.slice(1).map((m: any) => m.role), ["user", "assistant", "user"]);
  assert.equal(body.messages.at(-1).content, "Another example?");
});

test("normalizes a successful response into text plus usage metrics", async () => {
  const { impl } = stubFetch(() => json({
    message: { role: "assistant", content: "Supervised learning uses labelled data.", thinking: "internal reasoning" },
    prompt_eval_count: 30, eval_count: 335, eval_duration: 8_883_881_000, total_duration: 9_210_000_000,
  }));
  const result = await new OllamaProvider(config, impl).generate({ systemInstruction: "s", messages });
  assert.equal(result.text, "Supervised learning uses labelled data.");
  assert.equal(result.usage?.promptTokens, 30);
  assert.equal(result.usage?.completionTokens, 335);
  assert.equal(result.usage?.tokensPerSecond, 37.71);
  assert.equal(result.usage?.durationMs, 9210);
});

test("the separate thinking field never reaches the student", async () => {
  const { impl } = stubFetch(() => json({ message: { role: "assistant", content: "The answer.", thinking: "Hmm, let me reconsider..." } }));
  const result = await new OllamaProvider(config, impl).generate({ systemInstruction: "s", messages });
  assert.equal(result.text, "The answer.");
  assert.doesNotMatch(result.text, /Hmm/);
});

test("strips reasoning that leaks into content, including an unmatched closing tag", () => {
  // What this Ollama build actually returns when thinking is disabled.
  assert.equal(stripThinking("Hmm, the user wants...\n</think>\n\nThe real answer."), "The real answer.");
  assert.equal(stripThinking("<think>reasoning</think>The real answer."), "The real answer.");
  assert.equal(stripThinking("A clean answer."), "A clean answer.");
  assert.equal(stripThinking("<think>never closed"), "");
});

test("reports offline when the connection is refused", async () => {
  const { impl } = stubFetch(() => { throw Object.assign(new Error("fetch failed"), { name: "TypeError" }); });
  const err = await new OllamaProvider(config, impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.ok(err instanceof ProviderError);
  assert.equal(err.reason, "offline");
  assert.match(err.message, /offline.*start Ollama/i);
});

test("reports a timeout distinctly from being offline", async () => {
  const { impl } = stubFetch(() => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); });
  const err = await new OllamaProvider(config, impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.equal((err as ProviderError).reason, "timeout");
});

test("reports a missing model with the command that fixes it", async () => {
  const { impl } = stubFetch(() => new Response("model 'qwen3:4b' not found", { status: 404 }));
  const err = await new OllamaProvider(config, impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.equal((err as ProviderError).reason, "model_missing");
  assert.match((err as ProviderError).message, /ollama pull qwen3:4b/);
});

test("rejects a malformed response instead of passing rubbish to the student", async () => {
  const notJson = stubFetch(() => new Response("<html>gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } }));
  const a = await new OllamaProvider(config, notJson.impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.equal((a as ProviderError).reason, "malformed_response");

  const noContent = stubFetch(() => json({ message: { role: "assistant" } }));
  const b = await new OllamaProvider(config, noContent.impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.equal((b as ProviderError).reason, "malformed_response");
});

test("treats a runtime error field and an empty answer as generation failures", async () => {
  const errored = stubFetch(() => json({ error: "llama runner terminated" }));
  const a = await new OllamaProvider(config, errored.impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.equal((a as ProviderError).reason, "generation_failed");

  const empty = stubFetch(() => json({ message: { role: "assistant", content: "  " } }));
  const b = await new OllamaProvider(config, empty.impl).generate({ systemInstruction: "s", messages }).catch((e) => e);
  assert.equal((b as ProviderError).reason, "generation_failed");
});

test("availability requires the server to be up and holding the configured model", async () => {
  const up = stubFetch(() => json({ models: [{ name: "qwen3:4b" }] }));
  assert.deepEqual(await new OllamaProvider(config, up.impl).checkAvailability(), { available: true, model: "qwen3:4b" });

  const wrongModel = stubFetch(() => json({ models: [{ name: "llama3:8b" }] }));
  const missing = await new OllamaProvider(config, wrongModel.impl).checkAvailability();
  assert.equal(missing.available, false);
  assert.match(missing.detail ?? "", /ollama pull qwen3:4b/);

  const down = stubFetch(() => { throw Object.assign(new Error("refused"), { name: "TypeError" }); });
  const offline = await new OllamaProvider(config, down.impl).checkAvailability();
  assert.equal(offline.available, false);
  assert.match(offline.detail ?? "", /not reachable/i);
});

test("availability accepts a matching model family tag", async () => {
  const { impl } = stubFetch(() => json({ models: [{ name: "qwen3:latest" }] }));
  assert.equal((await new OllamaProvider(config, impl).checkAvailability()).available, true);
});

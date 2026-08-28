import assert from "node:assert/strict";
import test from "node:test";
import { getSystemInstruction, isSocratesMode } from "./prompts";
import { InMemoryConversationRepository } from "./persistence";
import { ProviderRouter } from "./providers/router";
import { StubProvider } from "./providers/testing";
import { SocratesService } from "./service";
import { SOCRATES_MODES } from "./types";

/** A router with both runtimes stubbed, so routing is exercised without any network. */
function makeRouter(overrides: { gemini?: StubProvider; ollama?: StubProvider } = {}) {
  const gemini = overrides.gemini ?? new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash");
  // Qwen3 is developer-tier in production; the stub mirrors that so these tests
  // exercise the same gate the real registry applies.
  const ollama = overrides.ollama ?? new StubProvider("qwen3-local", "Qwen3 Local", { tier: "developer" });
  return { gemini, ollama, router: new ProviderRouter([gemini, ollama], "gemini-2.5-flash") };
}

test("persists a new conversation and supplies it on its second turn", async () => {
  const repo = new InMemoryConversationRepository();
  const { gemini, router } = makeRouter();
  const service = new SocratesService(repo, router);
  await service.respond({ threadId: "thread-a", userId: "user-a", message: "First", mode: "socratic" });
  await service.respond({ threadId: "thread-a", userId: "user-a", message: "Second", mode: "eli5" });
  const state = await repo.load("thread-a", "user-a");
  assert.equal(state?.messages.length, 4);
  assert.equal(gemini.lastCall?.messages[0].text, "First");
  assert.match(gemini.lastCall?.systemInstruction ?? "", /ELI5/);
});

test("mode instructions are explicit and all valid modes are accepted", () => {
  for (const mode of SOCRATES_MODES) {
    assert.equal(isSocratesMode(mode), true);
    assert.match(getSystemInstruction(mode), /MODE:/);
  }
  assert.equal(isSocratesMode("unsupported"), false);
});

test("prevents one user from reading another user's thread", async () => {
  const { router } = makeRouter();
  const service = new SocratesService(new InMemoryConversationRepository(), router);
  await service.respond({ threadId: "private", userId: "owner", message: "secret", mode: "socratic" });
  await assert.rejects(
    () => service.respond({ threadId: "private", userId: "intruder", message: "read", mode: "socratic" }),
    /CONVERSATION_FORBIDDEN/
  );
});

test("propagates provider errors without persisting a partial model response", async () => {
  const repo = new InMemoryConversationRepository();
  const failing = new StubProvider("gemini-2.5-flash", "Gemini 2.5 Flash", { fail: () => { throw new Error("provider down"); } });
  const service = new SocratesService(repo, new ProviderRouter([failing], "gemini-2.5-flash"));
  await assert.rejects(() => service.respond({ threadId: "failure", userId: "user", message: "hello", mode: "socratic" }), /provider down/);
  assert.equal(await repo.load("failure", "user"), null);
});

test("every tutoring mode reaches the provider with its own system instruction", async () => {
  const { gemini, router } = makeRouter();
  const service = new SocratesService(new InMemoryConversationRepository(), router);
  for (const mode of SOCRATES_MODES) {
    await service.respond({ threadId: `thread-${mode}`, userId: "user-a", message: "Explain", mode });
    // A distinct instruction per mode proves the selection survives the route and the graph.
    assert.equal(gemini.lastCall?.systemInstruction, getSystemInstruction(mode));
  }
  assert.equal(new Set(gemini.calls.map((c) => c.systemInstruction)).size, SOCRATES_MODES.length);
});

test("every tutoring mode reaches the Ollama provider too", async () => {
  const { ollama, router } = makeRouter();
  const service = new SocratesService(new InMemoryConversationRepository(), router);
  for (const mode of SOCRATES_MODES) {
    await service.respond({ threadId: `ollama-${mode}`, userId: "user-a", message: "Explain", mode, model: "qwen3-local", developer: true });
    assert.equal(ollama.lastCall?.systemInstruction, getSystemInstruction(mode));
  }
  assert.equal(new Set(ollama.calls.map((c) => c.systemInstruction)).size, SOCRATES_MODES.length);
});

test("reopening a thread restores its history for the owner only", async () => {
  const repo = new InMemoryConversationRepository();
  const { gemini, router } = makeRouter();
  await new SocratesService(repo, router).respond({ threadId: "resume", userId: "owner", message: "What is supervised learning?", mode: "socratic" });
  // A fresh service instance stands in for a page reload / new server process.
  await new SocratesService(repo, router).respond({ threadId: "resume", userId: "owner", message: "Can you give me an example?", mode: "socratic" });
  const state = await repo.load("resume", "owner");
  assert.deepEqual(state?.messages.map((m) => m.role), ["user", "model", "user", "model"]);
  assert.equal(state?.messages[0].text, "What is supervised learning?");
  assert.equal(gemini.lastCall?.messages.length, 3);
  assert.equal(gemini.lastCall?.messages[0].text, "What is supervised learning?");
});

test("study context is forwarded to the provider when attached and omitted when not", async () => {
  const { gemini, router } = makeRouter();
  const service = new SocratesService(new InMemoryConversationRepository(), router);
  await service.respond({ threadId: "ctx", userId: "owner", message: "Summarise", mode: "eli5", context: "Chapter 4 notes" });
  assert.equal(gemini.lastCall?.context, "Chapter 4 notes");
  await service.respond({ threadId: "ctx-none", userId: "owner", message: "Summarise", mode: "eli5" });
  assert.equal(gemini.lastCall?.context, undefined);
});

test("switching model mid-thread keeps the conversation history intact", async () => {
  const repo = new InMemoryConversationRepository();
  const { gemini, ollama, router } = makeRouter();
  const service = new SocratesService(repo, router);

  const first = await service.respond({ threadId: "switch", userId: "owner", message: "What is supervised learning?", mode: "socratic", model: "gemini-2.5-flash" });
  assert.equal(first.model, "gemini-2.5-flash");

  // Same threadId, different runtime: the local model must see the Gemini turns.
  const second = await service.respond({ threadId: "switch", userId: "owner", message: "Another example?", mode: "socratic", model: "qwen3-local", developer: true });
  assert.equal(second.model, "qwen3-local");
  assert.equal(ollama.lastCall?.messages.length, 3);
  assert.equal(ollama.lastCall?.messages[0].text, "What is supervised learning?");
  assert.equal(ollama.lastCall?.messages[1].text, gemini.calls[0] && `gemini-2.5-flash:What is supervised learning?`);

  // ...and switching back preserves both models' turns in one thread.
  const third = await service.respond({ threadId: "switch", userId: "owner", message: "And once more?", mode: "socratic", model: "gemini-2.5-flash" });
  assert.equal(third.model, "gemini-2.5-flash");
  assert.equal(gemini.lastCall?.messages.length, 5);

  const state = await repo.load("switch", "owner");
  assert.equal(state?.messages.length, 6);
  assert.equal(state?.model, "gemini-2.5-flash");
});

test("the provider recorded on the thread follows the turn that produced the reply", async () => {
  const repo = new InMemoryConversationRepository();
  const { router } = makeRouter();
  const service = new SocratesService(repo, router);
  await service.respond({ threadId: "record", userId: "owner", message: "hi", mode: "socratic", model: "qwen3-local", developer: true });
  assert.equal((await repo.load("record", "owner"))?.model, "qwen3-local");
});

test("omitting the model uses the free default, not a locked one", async () => {
  const { gemini, ollama, router } = makeRouter();
  const service = new SocratesService(new InMemoryConversationRepository(), router);
  const result = await service.respond({ threadId: "default", userId: "owner", message: "hi", mode: "socratic" });
  assert.equal(result.model, "gemini-2.5-flash");
  assert.equal(gemini.calls.length, 1);
  assert.equal(ollama.calls.length, 0);
});

test("a developer-only model is refused unless developer access is proven", async () => {
  const repo = new InMemoryConversationRepository();
  const { ollama, router } = makeRouter();
  const service = new SocratesService(repo, router);

  // The claim has to be proven by the caller; the request itself cannot assert it.
  await assert.rejects(
    () => service.respond({ threadId: "locked", userId: "owner", message: "hi", mode: "socratic", model: "qwen3-local" }),
    (err: any) => err.name === "ModelAccessError" && err.modelId === "qwen3-local"
  );
  // Refused before any generation happens, and nothing is written to the thread.
  assert.equal(ollama.calls.length, 0);
  assert.equal(await repo.load("locked", "owner"), null);

  const allowed = await service.respond({ threadId: "locked", userId: "owner", message: "hi", mode: "socratic", model: "qwen3-local", developer: true });
  assert.equal(allowed.model, "qwen3-local");
  assert.equal(ollama.calls.length, 1);
});

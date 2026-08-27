import assert from "node:assert/strict";
import test from "node:test";
import { getSystemInstruction, isSocratesMode } from "./prompts";
import { InMemoryConversationRepository } from "./persistence";
import { ProviderRouter } from "./providers/router";
import { StubProvider } from "./providers/testing";
import { SocratesService } from "./service";
import { SOCRATES_MODES } from "./types";

/** A router with both runtimes stubbed, so routing is exercised without any network. */
function makeRouter(overrides: { gemini?: StubProvider; ollama?: StubProvider; defaultId?: "gemini" | "ollama" } = {}) {
  const gemini = overrides.gemini ?? new StubProvider("gemini", "Gemini");
  const ollama = overrides.ollama ?? new StubProvider("ollama", "Qwen3 Local");
  return { gemini, ollama, router: new ProviderRouter([gemini, ollama], overrides.defaultId ?? "gemini") };
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
  const failing = new StubProvider("gemini", "Gemini", { fail: () => { throw new Error("provider down"); } });
  const service = new SocratesService(repo, new ProviderRouter([failing], "gemini"));
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
    await service.respond({ threadId: `ollama-${mode}`, userId: "user-a", message: "Explain", mode, provider: "ollama" });
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

  const first = await service.respond({ threadId: "switch", userId: "owner", message: "What is supervised learning?", mode: "socratic", provider: "gemini" });
  assert.equal(first.provider, "gemini");

  // Same threadId, different runtime: the local model must see the Gemini turns.
  const second = await service.respond({ threadId: "switch", userId: "owner", message: "Another example?", mode: "socratic", provider: "ollama" });
  assert.equal(second.provider, "ollama");
  assert.equal(ollama.lastCall?.messages.length, 3);
  assert.equal(ollama.lastCall?.messages[0].text, "What is supervised learning?");
  assert.equal(ollama.lastCall?.messages[1].text, gemini.calls[0] && `gemini:What is supervised learning?`);

  // ...and switching back preserves both models' turns in one thread.
  const third = await service.respond({ threadId: "switch", userId: "owner", message: "And once more?", mode: "socratic", provider: "gemini" });
  assert.equal(third.provider, "gemini");
  assert.equal(gemini.lastCall?.messages.length, 5);

  const state = await repo.load("switch", "owner");
  assert.equal(state?.messages.length, 6);
  assert.equal(state?.provider, "gemini");
});

test("the provider recorded on the thread follows the turn that produced the reply", async () => {
  const repo = new InMemoryConversationRepository();
  const { router } = makeRouter();
  const service = new SocratesService(repo, router);
  await service.respond({ threadId: "record", userId: "owner", message: "hi", mode: "socratic", provider: "ollama" });
  assert.equal((await repo.load("record", "owner"))?.provider, "ollama");
});

test("omitting the provider uses the configured default", async () => {
  const { ollama, router } = makeRouter({ defaultId: "ollama" });
  const service = new SocratesService(new InMemoryConversationRepository(), router);
  const result = await service.respond({ threadId: "default", userId: "owner", message: "hi", mode: "socratic" });
  assert.equal(result.provider, "ollama");
  assert.equal(ollama.calls.length, 1);
});

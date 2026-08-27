# Socratic AI: LangGraph orchestration and model providers

This describes what is actually implemented in `server/socrates/`. Keep it in
step with the code — the diagrams below are not aspirational.

## Request path

```text
Browser (SocratesChatView)
      │  POST /api/socrates/chat  { threadId, message, mode, provider?, context? }
      │  Authorization: Bearer <Firebase ID token>
      ▼
Express API route (server.ts)
      │  validates input and resolves the caller from the token
      ▼
SocratesService (server/socrates/service.ts)
      │  loads history and asks ProviderRouter to resolve this turn's provider
      ▼
ProviderRouter (server/socrates/providers/router.ts)
      │  selects Gemini or Ollama/Qwen3; no model call occurs here
      ▼
LangGraph (server/socrates/graph.ts)
      │  supervisor → context_node → tutor_node
      ▼
ModelProvider
      │  GeminiProvider or OllamaProvider
      ▼
ConversationState persisted after a successful reply
      │  server/socrates/persistence.ts → Firestore `chats`
      ▼
{ reply, mode, threadId, provider }  →  client
```

## The graph

```text
                          START
                            │
                            ▼
                     ┌─────────────┐
                     │ supervisor  │  mode → system instruction, pick agent
                     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │context_node │  trims/attaches study context
                     └──────┬──────┘
                            │  conditional edge on state.agent
                            ▼
                     ┌─────────────┐
                     │ tutor_node  │  calls the injected ModelProvider
                     └──────┬──────┘
                            │
                            ▼
                           END
```

The graph is **provider-agnostic**. `createSocratesGraph(provider)` receives an
already-resolved provider and never inspects which runtime it is; there is no
`if (provider === "ollama")` anywhere in a graph node. Provider selection happens
once, in the router, before the graph is invoked.

## Model provider layer

```text
                    SocratesService
                          │
                          ▼
                   ProviderRouter          server/socrates/providers/router.ts
                   ┌──────┴──────┐
                   ▼             ▼
            GeminiProvider   OllamaProvider
                   │             │
                   ▼             ▼
           gemini-3.7-flash    Qwen3 (qwen3:4b)
             (hosted API)      (local, http://localhost:11434)
```

Every provider implements one interface (`providers/types.ts`):

```ts
interface ModelProvider {
  readonly id: ModelProviderId;          // "gemini" | "ollama"
  readonly name: string;                 // shown in the UI
  generate(request: GenerationRequest): Promise<GenerationResult>;
  checkAvailability(): Promise<ProviderAvailability>;
}
```

`GenerationRequest` carries only `{ systemInstruction, messages, context }` —
nothing provider-specific. `GenerationResult` is `{ text, usage? }`, so callers
never see Gemini's `candidates[]` or Ollama's `message.content`. Normalizing
those wire formats is each provider's job:

- **Gemini** maps `role: "model"` and reads `response.text`.
- **Ollama** maps `role: "model"` → `"assistant"`, merges the system instruction
  and study context into a leading system turn, requests `think: true` so Qwen3's
  reasoning is returned separately in `message.thinking` instead of leaking into
  the answer, and reports `eval_count / eval_duration` as tokens per second.

Failures become `ProviderError` with a `reason` (`offline`, `model_missing`,
`timeout`, `malformed_response`, `generation_failed`, `not_configured`) and a
message written for a student. The route maps the reason to an HTTP status
(503/504/502) and returns the message; stack traces stay in the server log.

## Tutoring modes

The five modes are **configuration, not implementations**. `prompts.ts` holds one
instruction string per mode, and `getSystemInstruction(mode)` is called once in
the supervisor node. Adding a mode means adding a string; no provider or graph
change is required, and both runtimes receive the same instruction.

## Availability

`GET /api/ai/providers` returns, for each registered provider, its id, display
name, whether it is the default, and whether it is currently usable. It exposes
no keys and no URLs.

Gemini reports available when `GEMINI_API_KEY` is configured **and** no outage
has been observed recently — deliberately a local check, so listing providers
costs no quota. When a generation returns 429 the provider remembers that the
daily free tier is spent until the next midnight US Pacific, and 503 hides it for
two minutes; otherwise the UI would keep selecting a runtime that cannot answer.
That memory is process-local and clears on a successful call.

Ollama probes `/api/tags` and requires both a reachable server **and** the
configured model to be present; a running Ollama with no model is not usable.

Which runtimes exist at all is set by `AI_PROVIDERS` (comma separated). A cloud
deployment sets `AI_PROVIDERS=gemini` so it never advertises a local model it
cannot reach — see `docs/DEPLOYMENT.md`.

## Conversation state and model switching

A turn is persisted **only when the model actually answered**. The client shows
the pending question immediately but writes nothing until the reply arrives, then
stores the user and assistant messages together. A failed turn leaves the error
on screen for that session only — it is never written to Firestore — so a
provider outage cannot inject a fabricated assistant message into the history,
and the rendered transcript never drifts from the history the model is given.

`ConversationState` records `provider` alongside `mode`, so a thread shows which
runtime produced the latest reply. Provider is chosen **per turn**, so switching
between Gemini and Qwen3 mid-conversation keeps the same `threadId` and the full
message history — the newly selected model receives every prior turn, including
the ones the other model produced.

## Adding future agents

`supervisor` sets `state.agent`, and a conditional edge dispatches on it. Today
the only agent is `tutor`. An Evaluator, Retrieval, Study Planner or Quiz agent
is added by:

1. extending `SOCRATES_AGENTS` in `graph.ts`,
2. adding a node and its entry in the conditional edge map,
3. teaching `supervisor` when to select it.

None of that touches the provider layer, so every new agent inherits both
runtimes for free.

import { ChatMessage } from "../types";

/**
 * Runtimes StudiSpace can talk to. This is the *transport*, not the choice a
 * student makes: one runtime can serve several selectable models.
 */
export const MODEL_PROVIDERS = ["gemini", "ollama"] as const;
export type ModelProviderId = (typeof MODEL_PROVIDERS)[number];

export function isModelProviderId(value: unknown): value is ModelProviderId {
  return typeof value === "string" && MODEL_PROVIDERS.includes(value as ModelProviderId);
}

/**
 * Models a student can actually pick, at model granularity rather than runtime
 * granularity. Selecting "gemini" and quietly resolving it to whichever Gemini
 * build the server happens to be configured with hides a real difference — the
 * hosted 3.x model is developer-only, the 2.5 model is what every student gets.
 */
export const AI_MODEL_IDS = ["gemini-2.5-flash", "gemini-3.7-flash", "qwen3-local"] as const;
export type AiModelId = (typeof AI_MODEL_IDS)[number];

export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === "string" && AI_MODEL_IDS.includes(value as AiModelId);
}

/**
 * Who may use a model. `free` is every signed-in student; `developer` requires a
 * server-verified Developer Mode token (see server/socrates/developerMode.ts).
 */
export type AccessTier = "free" | "developer";

/** Legacy request bodies name a runtime; map them to the model that runtime serves by default. */
export const LEGACY_PROVIDER_MODEL: Record<ModelProviderId, AiModelId> = {
  gemini: "gemini-2.5-flash",
  ollama: "qwen3-local",
};

/** What every provider receives. Nothing here is provider-specific. */
export interface GenerationRequest {
  systemInstruction: string;
  messages: ChatMessage[];
  context?: string;
}

/** What every provider returns, whatever shape the upstream API used. */
export interface GenerationResult {
  text: string;
  /** Populated when the runtime reports it; Gemini and Ollama expose different counters. */
  usage?: { promptTokens?: number; completionTokens?: number; durationMs?: number; tokensPerSecond?: number };
}

export interface ProviderAvailability {
  available: boolean;
  /** Short, user-safe explanation when unavailable. Never a stack trace. */
  detail?: string;
  /** Concrete model this provider would use, when known. */
  model?: string;
}

export interface ModelProvider {
  /** The selectable model, e.g. "gemini-2.5-flash". Unique across the registry. */
  readonly id: AiModelId;
  /** Which runtime serves it. Several models may share a runtime. */
  readonly runtime: ModelProviderId;
  /** Label shown in the UI. */
  readonly name: string;
  /** Access required to use it. Enforced by the router, not by the UI. */
  readonly tier: AccessTier;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  checkAvailability(): Promise<ProviderAvailability>;
}

/**
 * Provider failures the UI is expected to explain rather than swallow. The
 * message is written for a student, so it must stay free of stack traces.
 */
export class ProviderError extends Error {
  /**
   * `providerId` names the runtime that failed. It widens to a model id for the
   * one failure that has no runtime behind it: a model this server does not
   * register at all.
   */
  constructor(readonly providerId: ModelProviderId | AiModelId, readonly reason: ProviderErrorReason, message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export type ProviderErrorReason =
  | "offline"
  | "model_missing"
  | "timeout"
  | "malformed_response"
  | "generation_failed"
  | "not_configured";

/**
 * A developer-only model was requested without Developer Mode authorization.
 * Raised by the router, so the rule holds for every caller — the HTTP route, a
 * future queue worker, a test — and not only for the button that is greyed out.
 */
export class ModelAccessError extends Error {
  constructor(readonly modelId: AiModelId, message: string) {
    super(message);
    this.name = "ModelAccessError";
  }
}

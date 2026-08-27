import { ChatMessage } from "../types";

export const MODEL_PROVIDERS = ["gemini", "ollama"] as const;
export type ModelProviderId = (typeof MODEL_PROVIDERS)[number];

export function isModelProviderId(value: unknown): value is ModelProviderId {
  return typeof value === "string" && MODEL_PROVIDERS.includes(value as ModelProviderId);
}

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
  readonly id: ModelProviderId;
  /** Label shown in the UI. */
  readonly name: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  checkAvailability(): Promise<ProviderAvailability>;
}

/**
 * Provider failures the UI is expected to explain rather than swallow. The
 * message is written for a student, so it must stay free of stack traces.
 */
export class ProviderError extends Error {
  constructor(readonly providerId: ModelProviderId, readonly reason: ProviderErrorReason, message: string) {
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

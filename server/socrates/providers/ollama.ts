import { ChatMessage } from "../types";
import { GenerationRequest, GenerationResult, ModelProvider, ProviderAvailability, ProviderError } from "./types";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  /** Generation requests are slow on modest hardware; availability probes are not. */
  generateTimeoutMs?: number;
  availabilityTimeoutMs?: number;
}

/**
 * Defensive net for reasoning that leaks into the answer.
 *
 * Qwen3 is a thinking model. With `think: true` Ollama returns the trace in a
 * separate `message.thinking` field and `content` is already clean. With
 * `think: false` this build leaks the trace into `content` terminated by a
 * closing `</think>` that has no opening tag, so an unmatched closing tag must
 * be handled too: everything before it is reasoning, not the answer.
 */
export function stripThinking(text: string): string {
  const lastClose = text.lastIndexOf("</think>");
  if (lastClose !== -1) return text.slice(lastClose + "</think>".length).trim();
  return text.replace(/<think>[\s\S]*/g, "").trim();
}

/** Ollama speaks system/user/assistant; StudiSpace stores user/model/system. */
function toOllamaMessages(systemInstruction: string, messages: ChatMessage[], context?: string) {
  const system = context ? `${systemInstruction}\n\nSTUDY CONTEXT:\n${context}` : systemInstruction;
  return [
    { role: "system", content: system },
    ...messages.map((message) => ({
      role: message.role === "user" ? "user" : message.role === "system" ? "system" : "assistant",
      content: message.text,
    })),
  ];
}

export class OllamaProvider implements ModelProvider {
  readonly id = "ollama" as const;
  readonly name = "Qwen3 Local";
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly generateTimeoutMs: number;
  private readonly availabilityTimeoutMs: number;

  constructor(config: OllamaConfig, private readonly fetchImpl: typeof fetch = fetch) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.model = config.model;
    this.generateTimeoutMs = config.generateTimeoutMs ?? 180000;
    this.availabilityTimeoutMs = config.availabilityTimeoutMs ?? 2500;
  }

  /** Reachable *and* holding the configured model — a running server with no model is not usable. */
  async checkAvailability(): Promise<ProviderAvailability> {
    let payload: any;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(this.availabilityTimeoutMs) });
      if (!res.ok) return { available: false, model: this.model, detail: `Ollama replied with HTTP ${res.status}.` };
      payload = await res.json();
    } catch (err: any) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      return {
        available: false,
        model: this.model,
        detail: timedOut ? "Ollama did not respond in time." : "Ollama is not reachable.",
      };
    }
    const installed: string[] = Array.isArray(payload?.models) ? payload.models.map((m: any) => String(m?.name ?? "")) : [];
    // `qwen3:4b` and a bare `qwen3` both satisfy a configured `qwen3:4b`.
    const has = installed.some((name) => name === this.model || name.split(":")[0] === this.model.split(":")[0]);
    if (!has) {
      return { available: false, model: this.model, detail: `Model ${this.model} is not downloaded. Run: ollama pull ${this.model}` };
    }
    return { available: true, model: this.model };
  }

  async generate({ systemInstruction, messages, context }: GenerationRequest): Promise<GenerationResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: toOllamaMessages(systemInstruction, messages, context),
          stream: false,
          // Qwen3 reasons either way. Asking for it explicitly makes Ollama return the
          // trace in `message.thinking` and leave `message.content` clean; with
          // `think: false` the trace leaks into `content` instead. We keep only content.
          think: true,
          options: { temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(this.generateTimeoutMs),
      });
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        throw new ProviderError("ollama", "timeout", "Qwen3 Local took too long to answer. Try a shorter question.");
      }
      throw new ProviderError("ollama", "offline", "Qwen3 Local is offline. Please start Ollama and try again.");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 404 || /not found|no such model/i.test(body)) {
        throw new ProviderError("ollama", "model_missing", `Qwen3 model "${this.model}" is not installed. Run: ollama pull ${this.model}`);
      }
      throw new ProviderError("ollama", "generation_failed", "Qwen3 Local could not complete this answer.");
    }

    let payload: any;
    try {
      payload = await res.json();
    } catch {
      throw new ProviderError("ollama", "malformed_response", "Qwen3 Local returned a response StudiSpace could not read.");
    }
    if (payload?.error) {
      throw new ProviderError("ollama", "generation_failed", "Qwen3 Local could not complete this answer.");
    }

    const raw = payload?.message?.content;
    if (typeof raw !== "string") {
      throw new ProviderError("ollama", "malformed_response", "Qwen3 Local returned a response StudiSpace could not read.");
    }
    const text = stripThinking(raw);
    if (!text) {
      throw new ProviderError("ollama", "generation_failed", "Qwen3 Local returned an empty answer. Try rephrasing your question.");
    }

    const evalCount = Number(payload?.eval_count);
    const evalNanos = Number(payload?.eval_duration);
    return {
      text,
      usage: {
        promptTokens: Number.isFinite(Number(payload?.prompt_eval_count)) ? Number(payload.prompt_eval_count) : undefined,
        completionTokens: Number.isFinite(evalCount) ? evalCount : undefined,
        durationMs: Number.isFinite(Number(payload?.total_duration)) ? Math.round(Number(payload.total_duration) / 1e6) : undefined,
        tokensPerSecond: Number.isFinite(evalCount) && Number.isFinite(evalNanos) && evalNanos > 0
          ? Number((evalCount / (evalNanos / 1e9)).toFixed(2))
          : undefined,
      },
    };
  }
}

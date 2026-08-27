import { GoogleGenAI } from "@google/genai";
import { GenerationRequest, GenerationResult, ModelProvider, ProviderAvailability, ProviderError } from "./types";

export interface GeminiConfig {
  apiKey?: string;
  model: string;
  /** Injectable for tests; defaults to the real clock. */
  now?: () => number;
}

/** Google's free tier resets its per-day quota at midnight America/Los_Angeles. */
export function nextQuotaResetAt(now: number): number {
  const pacific = new Date(new Date(now).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offsetFromLocal = now - pacific.getTime();
  const nextPacificMidnight = new Date(pacific);
  nextPacificMidnight.setHours(24, 0, 0, 0);
  return nextPacificMidnight.getTime() + offsetFromLocal;
}

export class GeminiProvider implements ModelProvider {
  readonly id = "gemini" as const;
  readonly name = "Gemini";
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly now: () => number;
  /**
   * Remembers outages observed while generating. A configured API key alone is
   * not evidence that Gemini can answer: with the daily free-tier quota spent,
   * reporting "available" makes the UI select a runtime that cannot reply.
   * Process-local by design — it is a cache, not a source of truth.
   */
  private unavailableUntil = 0;
  private unavailableDetail = "";

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.now = config.now ?? (() => Date.now());
  }

  private client(): GoogleGenAI | null {
    if (!this.apiKey) return null;
    return new GoogleGenAI({ apiKey: this.apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  }

  /** Local check by design: listing providers must never spend generation quota. */
  async checkAvailability(): Promise<ProviderAvailability> {
    if (!this.apiKey) return { available: false, model: this.model, detail: "GEMINI_API_KEY is not configured on the server." };
    if (this.now() < this.unavailableUntil) return { available: false, model: this.model, detail: this.unavailableDetail };
    return { available: true, model: this.model };
  }

  private markUnavailable(untilMs: number, detail: string) {
    this.unavailableUntil = untilMs;
    this.unavailableDetail = detail;
  }

  async generate({ systemInstruction, messages, context }: GenerationRequest): Promise<GenerationResult> {
    const ai = this.client();
    if (!ai) throw new ProviderError("gemini", "not_configured", "Gemini is not configured on this server.");
    let response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
    try {
      response = await ai.models.generateContent({
        model: this.model,
        contents: messages.map((message) => ({ role: message.role === "user" ? "user" : "model", parts: [{ text: message.text }] })),
        config: { systemInstruction: context ? `${systemInstruction}\n\nSTUDY CONTEXT:\n${context}` : systemInstruction, temperature: 0.7 },
      });
    } catch (err: any) {
      const status = err?.status;
      if (status === 429) {
        this.markUnavailable(nextQuotaResetAt(this.now()), "Gemini's daily free-tier quota is used up. It resets at midnight US Pacific time.");
        throw new ProviderError("gemini", "generation_failed", "Gemini's daily free-tier quota is used up. Try Qwen3 Local, or retry tomorrow.");
      }
      if (status === 503) {
        // Transient capacity, not a quota wall: hide it only briefly.
        this.markUnavailable(this.now() + 120000, "Gemini is busy right now.");
        throw new ProviderError("gemini", "generation_failed", "Gemini is busy right now. Try again shortly, or switch to Qwen3 Local.");
      }
      throw new ProviderError("gemini", "generation_failed", "Gemini could not complete this answer.");
    }
    const text = response.text?.trim();
    if (!text) throw new ProviderError("gemini", "malformed_response", "Gemini returned an empty answer.");
    // A successful call clears any remembered outage.
    this.unavailableUntil = 0;
    const usage: any = (response as any).usageMetadata;
    return {
      text,
      usage: { promptTokens: usage?.promptTokenCount, completionTokens: usage?.candidatesTokenCount },
    };
  }
}

import {
  AccessTier,
  AiModelId,
  GenerationResult,
  ModelProvider,
  ModelProviderId,
  ProviderAvailability,
  ProviderError,
} from "./types";

/**
 * Stands in for a model whose runtime this deployment has switched off through
 * `AI_PROVIDERS`.
 *
 * It stays in the registry on purpose. The selector is a fixed, honest list of
 * the models StudiSpace knows about, so a cloud container without Ollama still
 * shows Qwen3 Local — greyed out, with the reason — instead of silently
 * renumbering the choices a student saw yesterday. Generation refuses outright,
 * so nothing can route to a runtime that was never built.
 */
export class DisabledProvider implements ModelProvider {
  constructor(
    readonly id: AiModelId,
    readonly runtime: ModelProviderId,
    readonly name: string,
    readonly tier: AccessTier,
    private readonly detail: string
  ) {}

  async checkAvailability(): Promise<ProviderAvailability> {
    return { available: false, detail: this.detail };
  }

  async generate(): Promise<GenerationResult> {
    throw new ProviderError(this.runtime, "not_configured", this.detail);
  }
}

import { GeminiProvider } from "./gemini";
import { OllamaProvider } from "./ollama";
import { ProviderRouter } from "./router";
import { isModelProviderId, ModelProvider, ModelProviderId } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3:4b";

/**
 * Which runtimes this deployment offers, from `AI_PROVIDERS` (comma separated).
 *
 * This is deliberately explicit rather than "register everything". A cloud
 * container has no Ollama of its own, and `localhost:11434` inside it is the
 * container, not the machine that built it — so a cloud deployment sets
 * `AI_PROVIDERS=gemini` and never advertises a local model it cannot reach.
 */
export function resolveEnabledProviders(env: NodeJS.ProcessEnv): ModelProviderId[] {
  const configured = (env.AI_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ModelProviderId => isModelProviderId(value));
  if (configured.length) return [...new Set(configured)];
  // Unset: offer both. Ollama simply reports offline when it is not reachable.
  return ["gemini", "ollama"];
}

/**
 * Builds the provider router from environment configuration. Model names and the
 * Ollama URL are configuration, never hard-coded at the call sites.
 */
export function createProviderRouter(env: NodeJS.ProcessEnv = process.env): ProviderRouter {
  const enabled = resolveEnabledProviders(env);
  const build: Record<ModelProviderId, () => ModelProvider> = {
    gemini: () => new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL }),
    ollama: () =>
      new OllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
        model: env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
      }),
  };
  const providers = enabled.map((id) => build[id]());

  const configuredDefault = env.DEFAULT_AI_PROVIDER;
  const preferred: ModelProviderId | undefined = isModelProviderId(configuredDefault) ? configuredDefault : undefined;
  // Fall back to the first enabled runtime so the default is always registered.
  const defaultProvider = preferred && enabled.includes(preferred) ? preferred : enabled[0];
  return new ProviderRouter(providers, defaultProvider);
}

export { GeminiProvider, OllamaProvider, ProviderRouter };
export * from "./types";

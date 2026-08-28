import { DisabledProvider } from "./disabled";
import { GeminiProvider } from "./gemini";
import { OllamaProvider } from "./ollama";
import { ProviderRouter } from "./router";
import { AiModelId, isModelProviderId, ModelProvider, ModelProviderId } from "./types";

/** The free model every student gets. Also the default when a request names none. */
export const FREE_GEMINI_MODEL = "gemini-2.5-flash";
/** The hosted model kept behind Developer Mode. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3:4b";

/** Selected when a chat request names no model. Free tier by construction. */
export const DEFAULT_MODEL_ID: AiModelId = "gemini-2.5-flash";

/**
 * Turns the configured Gemini model into the label a student sees:
 * `gemini-3.6-flash` becomes "Gemini 3.6 Flash".
 *
 * The label is derived rather than hard-coded so a deployment that overrides the
 * model cannot end up with a button that names a different one. A selector that
 * says "Gemini 3.7 Flash" while the server calls 3.6 is the exact confusion this
 * whole change exists to remove.
 */
export function geminiDisplayName(model: string): string {
  return model
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

/**
 * Which runtimes this deployment can actually reach, from `AI_PROVIDERS`
 * (comma separated).
 *
 * This is deliberately explicit rather than "register everything". A cloud
 * container has no Ollama of its own, and `localhost:11434` inside it is the
 * container, not the machine that built it — so a cloud deployment sets
 * `AI_PROVIDERS=gemini` and never tries to reach a local model.
 */
export function resolveEnabledProviders(env: NodeJS.ProcessEnv): ModelProviderId[] {
  const configured = (env.AI_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ModelProviderId => isModelProviderId(value));
  if (configured.length) return [...new Set(configured)];
  // Unset: enable both. Ollama simply reports offline when it is not reachable.
  return ["gemini", "ollama"];
}

/**
 * Builds the model registry from environment configuration.
 *
 * The catalogue is fixed at three entries — the selector a student sees must not
 * change shape with deployment configuration. `AI_PROVIDERS` decides whether an
 * entry is *usable*, not whether it exists: a disabled runtime yields a
 * DisabledProvider that reports why and refuses to generate.
 */
export function createProviderRouter(env: NodeJS.ProcessEnv = process.env): ProviderRouter {
  const enabled = new Set(resolveEnabledProviders(env));

  const gemini = (id: AiModelId, name: string, tier: "free" | "developer", model: string): ModelProvider =>
    enabled.has("gemini")
      ? new GeminiProvider({ id, name, tier, apiKey: env.GEMINI_API_KEY, model })
      : new DisabledProvider(id, "gemini", name, tier, `${name} is not enabled on this server.`);

  // Each slot's id is its default model; the concrete model, and therefore the
  // label, may be overridden per deployment.
  const freeModel = env.GEMINI_FREE_MODEL || FREE_GEMINI_MODEL;
  const developerModel = env.GEMINI_DEVELOPER_MODEL || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  const providers: ModelProvider[] = [
    gemini("gemini-2.5-flash", geminiDisplayName(freeModel), "free", freeModel),
    gemini("gemini-3.7-flash", geminiDisplayName(developerModel), "developer", developerModel),
    enabled.has("ollama")
      ? new OllamaProvider({
          id: "qwen3-local",
          name: "Qwen3 Local",
          tier: "developer",
          baseUrl: env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
          model: env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
        })
      : new DisabledProvider("qwen3-local", "ollama", "Qwen3 Local", "developer", "Qwen3 Local is not enabled on this server."),
  ];

  // The default is always the free model: it is what an unauthenticated student
  // must land on, so it is not configurable into a locked one.
  return new ProviderRouter(providers, DEFAULT_MODEL_ID);
}

export { DisabledProvider, GeminiProvider, OllamaProvider, ProviderRouter };
export * from "./types";

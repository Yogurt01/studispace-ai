import { AiModelId, ModelAccessError, ModelProvider, ProviderAvailability, ProviderError } from "./types";

export interface ModelDescriptor extends ProviderAvailability {
  id: AiModelId;
  name: string;
  /** "free" for every student, "developer" behind the Developer Mode password. */
  tier: ModelProvider["tier"];
  /** True for the model used when a request names none. Always a free-tier model. */
  isDefault: boolean;
  /** True when this caller may not use it yet. Presentation only — `resolve` is the real gate. */
  locked: boolean;
}

/** Whether this caller has proven Developer Mode. Never inferred from the request body. */
export interface ModelAccess {
  developer: boolean;
}

const NO_ACCESS: ModelAccess = { developer: false };

/**
 * Resolves a model id to the provider that serves it, and refuses models the
 * caller is not entitled to.
 *
 * The tier check lives here rather than in the HTTP route because the route is
 * not the only door: the service, a future job runner and the tests all resolve
 * through the router, and a rule enforced in one caller is a rule that the next
 * caller forgets. The UI's padlock is a courtesy; this is the enforcement.
 */
export class ProviderRouter {
  private readonly providers: Map<AiModelId, ModelProvider>;

  constructor(providers: ModelProvider[], private readonly defaultModelId: AiModelId) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
    const fallback = this.providers.get(defaultModelId);
    if (!fallback) throw new Error(`Default model "${defaultModelId}" is not registered`);
    // A developer-only default would hand every anonymous student a locked model.
    if (fallback.tier !== "free") throw new Error(`Default model "${defaultModelId}" must be free-tier`);
  }

  get defaultId(): AiModelId {
    return this.defaultModelId;
  }

  /**
   * @param modelId  omitted falls back to the free default
   * @param access   proven entitlements; defaults to a plain student
   */
  resolve(modelId?: AiModelId, access: ModelAccess = NO_ACCESS): ModelProvider {
    const id = modelId ?? this.defaultModelId;
    const provider = this.providers.get(id);
    if (!provider) throw new ProviderError(id, "not_configured", `Model "${id}" is not available on this server.`);
    if (provider.tier === "developer" && !access.developer) {
      throw new ModelAccessError(provider.id, `${provider.name} is restricted to Developer Mode.`);
    }
    return provider;
  }

  /** Availability for every registered model. Never includes keys, URLs, or secrets. */
  async describeAll(access: ModelAccess = NO_ACCESS): Promise<ModelDescriptor[]> {
    return Promise.all(
      [...this.providers.values()].map(async (provider) => {
        const availability = await provider
          .checkAvailability()
          .catch(() => ({ available: false, detail: "Availability check failed." }));
        return {
          id: provider.id,
          name: provider.name,
          tier: provider.tier,
          isDefault: provider.id === this.defaultModelId,
          locked: provider.tier === "developer" && !access.developer,
          ...availability,
        };
      })
    );
  }
}

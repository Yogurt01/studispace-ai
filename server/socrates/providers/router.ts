import { ModelProvider, ModelProviderId, ProviderAvailability, ProviderError } from "./types";

export interface ProviderDescriptor extends ProviderAvailability {
  id: ModelProviderId;
  name: string;
  /** True for the provider used when a request names none. */
  isDefault: boolean;
}

/**
 * Resolves a provider id to a provider. This is the only place that knows which
 * concrete runtimes exist — the graph, the service, and the routes stay agnostic.
 */
export class ProviderRouter {
  private readonly providers: Map<ModelProviderId, ModelProvider>;

  constructor(providers: ModelProvider[], private readonly defaultProviderId: ModelProviderId) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
    if (!this.providers.has(defaultProviderId)) {
      throw new Error(`Default provider "${defaultProviderId}" is not registered`);
    }
  }

  get defaultId(): ModelProviderId {
    return this.defaultProviderId;
  }

  resolve(providerId?: ModelProviderId): ModelProvider {
    const id = providerId ?? this.defaultProviderId;
    const provider = this.providers.get(id);
    if (!provider) throw new ProviderError(id, "not_configured", `Model provider "${id}" is not available on this server.`);
    return provider;
  }

  /** Availability for every registered provider. Never includes keys, URLs, or secrets. */
  async describeAll(): Promise<ProviderDescriptor[]> {
    return Promise.all(
      [...this.providers.values()].map(async (provider) => {
        const availability = await provider.checkAvailability().catch(() => ({ available: false, detail: "Availability check failed." }));
        return { id: provider.id, name: provider.name, isDefault: provider.id === this.defaultProviderId, ...availability };
      })
    );
  }
}

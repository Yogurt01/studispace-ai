import {
  AccessTier,
  AiModelId,
  GenerationRequest,
  GenerationResult,
  ModelProvider,
  ModelProviderId,
  ProviderAvailability,
} from "./types";

interface StubBehaviour {
  reply?: (request: GenerationRequest) => string;
  fail?: () => never;
  availability?: ProviderAvailability;
  /** Defaults to free so existing routing tests stay about routing. */
  tier?: AccessTier;
  runtime?: ModelProviderId;
}

/**
 * Records what the graph asked for and returns a canned reply. Lets tests assert
 * mode propagation, routing and continuity without any network call.
 */
export class StubProvider implements ModelProvider {
  readonly calls: GenerationRequest[] = [];
  readonly tier: AccessTier;
  readonly runtime: ModelProviderId;

  constructor(readonly id: AiModelId, readonly name: string, private readonly behaviour: StubBehaviour = {}) {
    this.tier = behaviour.tier ?? "free";
    this.runtime = behaviour.runtime ?? (id === "qwen3-local" ? "ollama" : "gemini");
  }

  async checkAvailability(): Promise<ProviderAvailability> {
    return this.behaviour.availability ?? { available: true };
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    this.calls.push(request);
    if (this.behaviour.fail) this.behaviour.fail();
    return { text: this.behaviour.reply ? this.behaviour.reply(request) : `${this.id}:${request.messages.at(-1)?.text}` };
  }

  get lastCall(): GenerationRequest | undefined {
    return this.calls.at(-1);
  }
}

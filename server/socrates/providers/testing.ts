import { GenerationRequest, GenerationResult, ModelProvider, ModelProviderId, ProviderAvailability } from "./types";

/**
 * Records what the graph asked for and returns a canned reply. Lets tests assert
 * mode propagation, routing and continuity without any network call.
 */
export class StubProvider implements ModelProvider {
  readonly calls: GenerationRequest[] = [];

  constructor(
    readonly id: ModelProviderId,
    readonly name: string,
    private readonly behaviour: {
      reply?: (request: GenerationRequest) => string;
      fail?: () => never;
      availability?: ProviderAvailability;
    } = {}
  ) {}

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

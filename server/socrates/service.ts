import { createSocratesGraph } from "./graph";
import { getSystemInstruction } from "./prompts";
import { ProviderRouter } from "./providers/router";
import { AiModelId } from "./providers/types";
import { ChatMessage, ConversationRepository, ConversationState, SocratesMode } from "./types";

export interface SocratesRequest {
  threadId: string;
  userId: string;
  message: string;
  mode: SocratesMode;
  context?: string;
  /** Which model to answer with. Omitted falls back to the free default. */
  model?: AiModelId;
  /**
   * Whether Developer Mode has been *proven* for this request. The caller
   * verifies the token; the router decides what that unlocks. Never taken from
   * the request body.
   */
  developer?: boolean;
}

export class SocratesService {
  constructor(private repo: ConversationRepository, private router: ProviderRouter) {}

  async respond(input: SocratesRequest) {
    // Authorization first, before any I/O. Resolving the model after loading the
    // conversation meant a datastore error could surface instead of the refusal,
    // turning a clean 403 into a 500 — and it let an unauthorized request read a
    // thread on its way to being denied. The model is still chosen per turn, so
    // a thread can switch models without losing its history.
    const provider = this.router.resolve(input.model, { developer: input.developer === true });
    const previous = await this.repo.load(input.threadId, input.userId);
    const now = Date.now();
    const userMessage: ChatMessage = { id: `usr-${now}`, userId: input.userId, role: "user", text: input.message, timestamp: new Date(now).toISOString(), mode: input.mode, createdAt: now };
    const state: ConversationState = { threadId: input.threadId, userId: input.userId, mode: input.mode, messages: [...(previous?.messages || []), userMessage].slice(-20), currentMessage: input.message, context: input.context, model: provider.id, updatedAt: now };
    const graphResult = await createSocratesGraph(provider).invoke(state);
    const reply = graphResult.reply || "No response generated.";
    const modelMessage: ChatMessage = { id: `ai-${now}`, userId: input.userId, role: "model", text: reply, timestamp: new Date(now).toISOString(), mode: input.mode, createdAt: now + 1 };
    const persisted = { ...state, systemInstruction: getSystemInstruction(input.mode), reply, messages: [...state.messages, modelMessage], updatedAt: Date.now() };
    await this.repo.save(persisted);
    return { reply, mode: input.mode, threadId: input.threadId, model: provider.id, provider: provider.runtime };
  }
}

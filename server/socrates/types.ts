import { AiModelId } from "./providers/types";

export const SOCRATES_MODES = ["socratic", "eli5", "exam_grill", "mnemonic", "roast_essay"] as const;
export type SocratesMode = (typeof SOCRATES_MODES)[number];

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "model" | "system";
  text: string;
  timestamp: string;
  mode?: SocratesMode;
  createdAt: number;
}

export interface ConversationState {
  threadId: string;
  userId: string;
  mode: SocratesMode;
  messages: ChatMessage[];
  currentMessage: string;
  context?: string;
  systemInstruction?: string;
  reply?: string;
  /** Which model produced `reply`. Threads may switch models between turns. */
  model?: AiModelId;
  updatedAt: number;
}

export interface ConversationRepository {
  load(threadId: string, userId: string): Promise<ConversationState | null>;
  save(state: ConversationState): Promise<void>;
}

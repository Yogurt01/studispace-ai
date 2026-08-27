import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { webcrypto } from "node:crypto";
import { getSystemInstruction } from "./prompts";
import { ModelProvider } from "./providers/types";
import { ConversationState } from "./types";

// LangGraph uses Web Crypto for checkpoint IDs; Node 20 provides it globally.
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

/** Agents the supervisor can dispatch to. Future agents (evaluator, retrieval,
 *  study planner, quiz) join this union and get their own node — no provider or
 *  conversation-state changes required. */
export const SOCRATES_AGENTS = ["tutor"] as const;
export type SocratesAgent = (typeof SOCRATES_AGENTS)[number];

const State = Annotation.Root({
  threadId: Annotation<string>, userId: Annotation<string>, mode: Annotation<ConversationState["mode"]>,
  messages: Annotation<ConversationState["messages"]>, currentMessage: Annotation<string>, context: Annotation<string | undefined>,
  systemInstruction: Annotation<string | undefined>, reply: Annotation<string | undefined>, updatedAt: Annotation<number>,
  agent: Annotation<SocratesAgent | undefined>,
});

/**
 * The graph is provider-agnostic: it receives an already-resolved provider and
 * never inspects which runtime it is. Provider selection happens in the router,
 * and provider-specific behaviour lives inside the provider itself.
 */
export function createSocratesGraph(provider: ModelProvider) {
  return new StateGraph(State)
    // Supervisor: turns the requested mode into a system instruction and picks the agent.
    .addNode("supervisor", (state) => ({ systemInstruction: getSystemInstruction(state.mode), agent: "tutor" as const }))
    .addNode("context_node", (state) => ({ context: state.context?.trim() || undefined }))
    .addNode("tutor_node", async (state) => ({
      reply: (await provider.generate({ systemInstruction: state.systemInstruction!, messages: state.messages, context: state.context })).text,
    }))
    .addEdge(START, "supervisor")
    .addEdge("supervisor", "context_node")
    // Conditional dispatch keeps the seam where additional agents will branch.
    .addConditionalEdges("context_node", (state) => state.agent ?? "tutor", { tutor: "tutor_node" })
    .addEdge("tutor_node", END)
    .compile();
}

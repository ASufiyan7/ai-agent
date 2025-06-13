// lib/langgraph.ts

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { Runnable } from "@langchain/core/runnables";

import SYSTEM_MESSAGE from "@/constants/systemMessage";
import { helpTool } from "./tools/helpTools";
import { youtubeTranscriptTool } from "./tools/youtube_transcript";
import { googleBooksTool } from "./tools/google_books";
import { wikipediaTool } from "./tools/wikipedia";
import { curlCommentsTool } from "./tools/curl";
import { jsonataTool } from "./tools/jsonata";


let graph: Runnable | null = null;

// --- FINAL FIX: Aggressive message trimming for production resilience ---
const trimmer = trimMessages({
  maxTokens: 4000, // Reduced to leave a large buffer for the model's response
  strategy: "last",
  tokenCounter: (messages) =>
    messages.reduce((acc, msg) => acc + (msg.content as string).length, 0) / 4,
  includeSystem: false,
  allowPartial: false,
});

function shouldContinue(state: { messages: BaseMessage[] }) {
  const msgs = state.messages;
  const last = msgs[msgs.length - 1] as AIMessage;
  return last.tool_calls?.length ? "tools" : END;
}

export async function getLangGraph(): Promise<Runnable> {
  if (graph) {
    return graph;
  }

  const allTools = [
    helpTool,
    youtubeTranscriptTool,
    googleBooksTool,
    wikipediaTool,
    curlCommentsTool,
    jsonataTool,
  ];
  const toolNode = new ToolNode(allTools);

  const model = new ChatGroq({
    model: "llama3-8b-8192",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0.7,
    maxTokens: 4096, // Max tokens for the *output*
    streaming: true,
  }).bindTools(allTools);

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const trimmedMessages = await trimmer.invoke(state.messages);
      const prompt = await ChatPromptTemplate.fromMessages([
        new SystemMessage(SYSTEM_MESSAGE),
        new MessagesPlaceholder("messages"),
      ]).invoke({
        messages: trimmedMessages,
      });
      const response = await model.invoke(prompt);
      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  const checkpointer = new MemorySaver();
  graph = workflow.compile({ checkpointer });

  return graph;
}

// app/api/chat/stream/route.ts

import { getLangGraph } from "@/lib/langgraph";
import { api } from "@/convex/_generated/api";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getConvexClient } from "@/lib/convex";
import {
  ChatRequestBody,
  StreamMessage,
  StreamMessageType,
  SSE_DATA_PREFIX,
  SSE_LINE_DELIMITER,
} from "@/lib/types";

export const runtime = "edge";

// Helper to send Server-Sent Events
function sendSSEMessage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  data: StreamMessage
) {
  const encoder = new TextEncoder();
  return writer.write(
    encoder.encode(
      `${SSE_DATA_PREFIX}${JSON.stringify(data)}${SSE_LINE_DELIMITER}`
    )
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages, newMessage, chatId } =
      (await req.json()) as ChatRequestBody;
    const convex = getConvexClient();

    // Store the user's message immediately
    await convex.mutation(api.messages.send, {
      chatId,
      content: newMessage,
    });

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const response = new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

    // This is the main async block that handles the AI stream
    (async () => {
      let assistantReply = "";
      try {
        await sendSSEMessage(writer, { type: StreamMessageType.Connected });

        const langChainMessages = [
          ...messages.map((m) =>
            m.role === "user"
              ? new HumanMessage(m.content)
              : new AIMessage(m.content)
          ),
          new HumanMessage(newMessage),
        ];

        // 1. Get the initialized LangGraph application
        const app = await getLangGraph();

        // 2. Start the stream
        const eventStream = await app.stream(
          { messages: langChainMessages },
          { configurable: { thread_id: chatId }, recursionLimit: 50 }
        );

        // 3. --- CORRECTED STREAM PROCESSING LOOP ---
        for await (const event of eventStream) {
          // The event object has a key named after the node that produced it (e.g., "agent" or "tools")
          if (event.agent) {
            const message = event.agent.messages.at(-1);
            // Check if the agent is calling a tool
            if (message?.tool_calls?.length > 0) {
              const toolCall = message.tool_calls[0];
              await sendSSEMessage(writer, {
                type: StreamMessageType.ToolStart,
                tool: toolCall.type,
                input: toolCall.args,
              });
            } else if (message?.content) {
              // This is a regular message token
              const token = message.content as string;
              assistantReply += token;
              await sendSSEMessage(writer, {
                type: StreamMessageType.Token,
                token: token,
              });
            }
          } else if (event.tools) {
            // Handle the output from a tool call
            const toolMessage = event.tools.messages.at(-1);
            await sendSSEMessage(writer, {
              type: StreamMessageType.ToolEnd,
              tool: toolMessage.name || "unknown",
              output: toolMessage.content,
            });
          }
        }
        // --- END OF CORRECTED LOOP ---

        // Store the final, complete assistant reply
        await convex.mutation(api.messages.store, {
          chatId,
          content: assistantReply,
          role: "assistant",
        });

        await sendSSEMessage(writer, { type: StreamMessageType.Done });
      } catch (err) {
        console.error("Error in event stream:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown stream error";
        await sendSSEMessage(writer, {
          type: StreamMessageType.Error,
          error: errorMessage,
        });
      } finally {
        await writer.close();
      }
    })();

    return response;
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
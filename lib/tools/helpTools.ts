// lib/tools/helpTool.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const helpTool = new DynamicStructuredTool({
  name: "help",
  description: "Provides help information and lists all available tools.",
  // This tool takes no arguments, so the schema is an empty object.
  schema: z.object({}),
  func: async () => {
    // This function simply returns a static string listing the other tools.
    return "You can use the following tools: youtube_transcript, google_books, wikipedia, curl_comments, jsonata.";
  },
});

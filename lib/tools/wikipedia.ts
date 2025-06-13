// tools/wikipedia.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import wikipedia from "wikipedia";

export const wikipediaTool = new DynamicStructuredTool({
  name: "wikipedia",
  description: "Search for a term on Wikipedia and get a summary.",
  schema: z.object({
    query: z.string().describe("The search term to look up on Wikipedia."),
  }),
  func: async ({ query }) => {
    try {
      const page = await wikipedia.page(query);
      const summary = await page.summary();

      if (summary.extract) {
        // FIX: Truncate the summary to prevent exceeding API token limits.
        const snippet = summary.extract.substring(0, 4500);
        return `Summary for "${query}" from Wikipedia:\n${snippet}... (truncated)`;
      }
      return `Could not find a summary for "${query}".`;
    } catch (error) {
      console.error(`Error fetching from Wikipedia: ${error}`);
      return `An error occurred while trying to fetch from Wikipedia. The page for "${query}" may not exist.`;
    }
  },
});

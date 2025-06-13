// tools/google_books.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Define the schema for the tool's input.
const googleBooksSchema = z.object({
  q: z.string().describe("The search query for books."),
  maxResults: z
    .number()
    .optional()
    .default(3) // FIX: Reduced from 5 to 3 to lower token usage.
    .describe("The maximum number of results to return."),
});

// Create the tool using DynamicStructuredTool.
export const googleBooksTool = new DynamicStructuredTool({
  name: "google_books",
  description: "Search for books using the Google Books API.",
  schema: googleBooksSchema,
  func: async ({ q, maxResults }) => {
    try {
      const url = new URL("https://www.googleapis.com/books/v1/volumes");
      url.searchParams.append("q", q);
      url.searchParams.append("maxResults", maxResults.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        return `Error: Received status ${response.status} from Google Books API.`;
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return `No books found for query: "${q}"`;
      }

      // Format the results to be more concise
      const results = data.items.map((item: any) => ({
        title: item.volumeInfo.title,
        authors: item.volumeInfo.authors || ["N/A"],
        publishedDate: item.volumeInfo.publishedDate || "N/A",
        // FIX: Shortened description from 200 to 100 characters.
        description: item.volumeInfo.description
          ? item.volumeInfo.description.substring(0, 100) + "..."
          : "No description available.",
      }));

      return JSON.stringify(results, null, 2);
    } catch (error) {
      console.error("Error fetching from Google Books API:", error);
      return "An unexpected error occurred while trying to fetch from the Google Books API.";
    }
  },
});

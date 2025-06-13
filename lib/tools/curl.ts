// tools/curl.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const curlCommentsTool = new DynamicStructuredTool({
  name: "curl_comments",
  description:
    "Fetch sample comments from the JSONPlaceholder API. Can optionally return only specific fields.",
  // FIX: The schema now accepts an optional 'fields' array.
  schema: z.object({
    fields: z
      .array(z.string())
      .optional()
      .describe(
        "A list of fields to return for each comment (e.g., ['name', 'email', 'body'])."
      ),
  }),
  func: async ({ fields }) => {
    try {
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/comments?_limit=5"
      );

      if (!response.ok) {
        return `Error: Received status ${response.status} from JSONPlaceholder API.`;
      }

      let data = await response.json();

      // FIX: If the 'fields' argument is provided, process the data.
      if (fields && fields.length > 0) {
        data = data.map((comment: any) => {
          const newComment: { [key: string]: any } = {};
          for (const field of fields) {
            if (comment[field]) {
              newComment[field] = comment[field];
            }
          }
          return newComment;
        });
      }

      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error(`Error fetching comments: ${error}`);
      return "An unexpected error occurred while trying to fetch comments.";
    }
  },
});

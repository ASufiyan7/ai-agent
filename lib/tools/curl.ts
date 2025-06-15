// lib/tools/curl.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Define a type for the comment object to avoid using 'any'
interface Comment {
  postId: number;
  id: number;
  name: string;
  email: string;
  body: string;
  [key: string]: any; 
}

export const curlCommentsTool = new DynamicStructuredTool({
  name: "curl_comments",
  description:
    "Fetch sample comments from the JSONPlaceholder API. Can optionally return only specific fields.",
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

      const data: Comment[] = await response.json();

      // FIX: If fields are requested, map to a new variable instead of reassigning.
      if (fields && fields.length > 0) {
        const filteredData = data.map((comment: Comment) => {
          const newComment: { [key: string]: any } = {};
          for (const field of fields) {
            if (comment[field]) {
              newComment[field] = comment[field];
            }
          }
          return newComment;
        });
        // Return the new, filtered data
        return JSON.stringify(filteredData, null, 2);
      }

      // If no fields are requested, return the original data
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error(`Error fetching comments: ${error}`);
      return "An unexpected error occurred while trying to fetch comments.";
    }
  },
});

// lib/tools/curl.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Define a precise type for the original comment data
interface Comment {
  postId: number;
  id: number;
  name: string;
  email: string;
  body: string;
}

// Define a type for the new object we create after filtering
type FilteredComment = { [key: string]: string | number };

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

      if (fields && fields.length > 0) {
        // This mapping logic is now correctly typed and will pass the linter
        const filteredData = data.map((comment): FilteredComment => {
          const newComment: FilteredComment = {};
          for (const field of fields) {
            // A safer way to check if the property exists
            if (Object.prototype.hasOwnProperty.call(comment, field)) {
              newComment[field] = comment[field as keyof Comment];
            }
          }
          return newComment;
        });
        return JSON.stringify(filteredData, null, 2);
      }

      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error(`Error fetching comments: ${error}`);
      return "An unexpected error occurred while trying to fetch comments.";
    }
  },
});

// tools/jsonata.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import jsonata from "jsonata"; // Import the core jsonata package

export const jsonataTool = new DynamicStructuredTool({
  name: "jsonata",
  description: "Transform a JSON object using a JSONata expression.",
  schema: z.object({
    data: z.any().describe("The input JSON object or array to be transformed."),
    expression: z.string().describe("The JSONata expression to apply."),
  }),
  func: async ({ data, expression }) => {
    try {
      // Use the jsonata package directly
      const jex = jsonata(expression);
      const result = await jex.evaluate(data); // The evaluate method is async
      return JSON.stringify(result, null, 2);
    } catch (error) {
      console.error(`Error applying JSONata expression: ${error}`);
      return "An error occurred while applying the JSONata expression. Ensure the expression and data are valid.";
    }
  },
});

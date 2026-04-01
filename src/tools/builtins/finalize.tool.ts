import { Tool } from "../tool.js";

export const FINALIZE_TOOL_NAME = "finalize";

export function createFinalizeTool(): Tool {
  return {
    definition: {
      name: FINALIZE_TOOL_NAME,
      description:
        "Call this tool when the task is complete. Pass your final answer as the 'result' argument.",
      parameters: [
        {
          name: "result",
          type: "string",
          description: "The final result or answer for the task.",
          required: true,
        },
      ],
    },
    async execute(args) {
      const result = args.result as string;
      if (!result) {
        throw new Error("The 'result' argument is required.");
      }
      return result;
    },
  };
}

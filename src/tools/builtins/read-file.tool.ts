import { readFileSync } from "node:fs";
import { Tool } from "../tool.js";
import { resolveSafePath } from "../../storage/paths.js";

export function createReadFileTool(workspaceRoot: string): Tool {
  return {
    definition: {
      name: "read_file",
      description: "Read the contents of a file within the workspace.",
      parameters: [
        {
          name: "path",
          type: "string",
          description: "Relative path to the file within the workspace.",
          required: true,
        },
      ],
    },
    async execute(args) {
      const filePath = args.path as string;
      if (!filePath) {
        throw new Error("The 'path' argument is required.");
      }

      const safePath = resolveSafePath(workspaceRoot, filePath);
      const content = readFileSync(safePath, "utf-8");
      return content;
    },
  };
}

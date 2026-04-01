import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Tool } from "../tool.js";
import { resolveSafePath } from "../../storage/paths.js";

export function createWriteFileTool(workspaceRoot: string): Tool {
  return {
    definition: {
      name: "write_file",
      description:
        "Write content to a file within the workspace. Creates parent directories if needed.",
      parameters: [
        {
          name: "path",
          type: "string",
          description: "Relative path to the file within the workspace.",
          required: true,
        },
        {
          name: "content",
          type: "string",
          description: "The content to write to the file.",
          required: true,
        },
      ],
    },
    async execute(args) {
      const filePath = args.path as string;
      const content = args.content as string;

      if (!filePath) {
        throw new Error("The 'path' argument is required.");
      }
      if (content === undefined || content === null) {
        throw new Error("The 'content' argument is required.");
      }

      const safePath = resolveSafePath(workspaceRoot, filePath);
      mkdirSync(dirname(safePath), { recursive: true });
      writeFileSync(safePath, content, "utf-8");

      return `File written: ${filePath}`;
    },
  };
}

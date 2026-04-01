import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Tool } from "../tool.js";

export function createListFilesTool(workspaceRoot: string): Tool {
  const resolvedRoot = resolve(workspaceRoot);

  return {
    definition: {
      name: "list_files",
      description:
        "List files and directories at a given path within the workspace.",
      parameters: [
        {
          name: "path",
          type: "string",
          description: "Relative path within the workspace. Defaults to '.'",
        },
      ],
    },
    async execute(args) {
      const relativePath = (args.path as string) || ".";
      const targetPath = resolve(resolvedRoot, relativePath);

      // Safety: ensure we stay within workspace
      if (!targetPath.startsWith(resolvedRoot)) {
        throw new Error("Path is outside the workspace boundary.");
      }

      const entries = readdirSync(targetPath);
      const results = entries.map((entry) => {
        const fullPath = join(targetPath, entry);
        const stat = statSync(fullPath);
        return `${stat.isDirectory() ? "[dir]" : "[file]"} ${entry}`;
      });

      return results.length > 0
        ? results.join("\n")
        : "(empty directory)";
    },
  };
}

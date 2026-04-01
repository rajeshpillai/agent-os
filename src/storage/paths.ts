import { resolve } from "node:path";

export function resolveSafePath(workspaceRoot: string, relativePath: string): string {
  const resolvedRoot = resolve(workspaceRoot);
  const targetPath = resolve(resolvedRoot, relativePath);

  if (!targetPath.startsWith(resolvedRoot)) {
    throw new Error("Path is outside the workspace boundary.");
  }

  return targetPath;
}

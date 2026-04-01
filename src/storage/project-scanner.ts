import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface ProjectFile {
  path: string;       // relative path from project root
  type: "file" | "dir";
  size: number;       // bytes (0 for dirs)
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  ".agent-os",
  ".prisma",
  "coverage",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

/**
 * Recursively scan a project directory and return a flat list of files/dirs.
 * Excludes node_modules, .git, build artifacts, and lock files.
 * Caps at maxFiles to avoid blowing up the prompt.
 */
export function scanProject(rootPath: string, maxFiles: number = 200): ProjectFile[] {
  const results: ProjectFile[] = [];

  function walk(dir: string) {
    if (results.length >= maxFiles) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    // Sort: dirs first, then files, alphabetical
    const sorted = entries
      .filter(e => !e.startsWith(".") || e === ".env.example" || e === ".env")
      .sort((a, b) => {
        const aIsDir = statSync(join(dir, a)).isDirectory();
        const bIsDir = statSync(join(dir, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

    for (const entry of sorted) {
      if (results.length >= maxFiles) break;

      const fullPath = join(dir, entry);
      const relPath = relative(rootPath, fullPath);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (IGNORED_DIRS.has(entry)) continue;
        results.push({ path: relPath, type: "dir", size: 0 });
        walk(fullPath);
      } else {
        if (IGNORED_FILES.has(entry)) continue;
        results.push({ path: relPath, type: "file", size: stat.size });
      }
    }
  }

  walk(rootPath);
  return results;
}

/**
 * Format a project file list into a readable tree string for the system prompt.
 */
export function formatProjectTree(files: ProjectFile[]): string {
  if (files.length === 0) return "(empty project)";

  const lines = files.map(f => {
    const icon = f.type === "dir" ? "📁" : "📄";
    const size = f.type === "file" ? ` (${formatSize(f.size)})` : "";
    return `${icon} ${f.path}${size}`;
  });

  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Skill } from "./models.js";

interface SkillFrontmatter {
  name?: string;
  description?: string;
  tags?: string[];
  tools?: string[];
}

function parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw.trim() };
  }

  const frontmatter: SkillFrontmatter = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (!key || !value) continue;

    const k = key.trim();
    if (k === "name") frontmatter.name = value;
    else if (k === "description") frontmatter.description = value;
    else if (k === "tags") frontmatter.tags = value.split(",").map(t => t.trim());
    else if (k === "tools") frontmatter.tools = value.split(",").map(t => t.trim());
  }

  return { frontmatter, body: match[2].trim() };
}

export function loadSkill(skillDir: string): Skill | null {
  const skillFile = join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) return null;

  const raw = readFileSync(skillFile, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);

  // Derive name from directory if not in frontmatter
  const dirName = skillDir.split("/").pop() ?? "unknown";

  return {
    name: frontmatter.name ?? dirName,
    description: frontmatter.description ?? "",
    instructions: body,
    tags: frontmatter.tags ?? [],
    tools: frontmatter.tools,
  };
}

export function loadAllSkills(skillsRoot: string): Skill[] {
  if (!existsSync(skillsRoot)) return [];

  const skills: Skill[] = [];
  const entries = readdirSync(skillsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skill = loadSkill(join(skillsRoot, entry.name));
    if (skill) skills.push(skill);
  }

  return skills;
}

export function selectSkillsForTask(skills: Skill[], taskDescription: string): Skill[] {
  const descLower = taskDescription.toLowerCase();

  return skills.filter(skill => {
    // Match by tag
    if (skill.tags.some(tag => descLower.includes(tag.toLowerCase()))) return true;
    // Match by skill name
    if (descLower.includes(skill.name.toLowerCase())) return true;
    // Match by description keywords
    const descWords = skill.description.toLowerCase().split(/\s+/);
    if (descWords.some(word => word.length > 3 && descLower.includes(word))) return true;
    return false;
  });
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map(skill => {
    let section = `### Skill: ${skill.name}`;
    if (skill.description) section += `\n${skill.description}`;
    section += `\n\n${skill.instructions}`;
    if (skill.tools?.length) {
      section += `\n\nAvailable tools for this skill: ${skill.tools.join(", ")}`;
    }
    return section;
  });

  return "## Active Skills\n\n" + sections.join("\n\n---\n\n");
}

/**
 * Downloads the official Remotion skills from GitHub and uploads them
 * as a custom Agent Skill to the Anthropic API.
 *
 * Usage:
 *   npx tsx scripts/upload-remotion-skill.ts
 *
 * Requires ANTHROPIC_API_KEY in environment.
 * Prints the skill_id to add to .env as ANTHROPIC_REMOTION_SKILL_ID.
 */

import Anthropic, { toFile } from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const REPO = "remotion-dev/skills";
const BRANCH = "main";
const SKILL_DIR = "skills/remotion"; // Path within the repo

interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  url: string;
}

async function fetchRepoTree(): Promise<GitHubTreeEntry[]> {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.tree;
}

async function downloadFile(filePath: string): Promise<Buffer> {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${filePath}: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log(`Fetching file list from ${REPO}...`);
  const tree = await fetchRepoTree();

  // Filter to only files under skills/remotion/
  const skillFiles = tree.filter(
    (entry) =>
      entry.type === "blob" && entry.path.startsWith(`${SKILL_DIR}/`),
  );

  console.log(`Found ${skillFiles.length} files in ${SKILL_DIR}/`);

  // Download all files in parallel
  console.log("Downloading files...");
  const downloaded = await Promise.all(
    skillFiles.map(async (entry) => {
      const content = await downloadFile(entry.path);
      // Strip the skill dir prefix so SKILL.md is at root
      const relativeName = entry.path.slice(`${SKILL_DIR}/`.length);
      console.log(`  ${relativeName} (${content.length} bytes)`);
      return { name: relativeName, content };
    }),
  );

  // Also save a local copy for reference
  const localDir = path.join(process.cwd(), ".remotion-skill");
  fs.mkdirSync(localDir, { recursive: true });
  for (const file of downloaded) {
    const dest = path.join(localDir, file.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, new Uint8Array(file.content));
  }
  console.log(`\nLocal copy saved to ${localDir}/`);

  // Upload to Anthropic Skills API
  const client = new Anthropic({ apiKey });

  console.log("\nUploading to Anthropic Skills API...");

  // The API requires the top-level folder name to match the skill name in SKILL.md.
  // Remotion's SKILL.md declares name: remotion-best-practices
  const TOP_DIR = "remotion-best-practices";
  const uploadableFiles = await Promise.all(
    downloaded.map((f) =>
      toFile(new Blob([new Uint8Array(f.content)]), `${TOP_DIR}/${f.name}`),
    ),
  );

  const skill = await client.beta.skills.create(
    { display_title: "Remotion Motion Graphics", files: uploadableFiles },
    // @ts-expect-error — betas is valid for beta endpoints
    { betas: ["skills-2025-10-02"] },
  );

  console.log(`\nSkill uploaded successfully!`);
  console.log(`  skill_id: ${skill.id}`);
  console.log(`  version:  ${skill.latest_version}`);
  console.log(`\nAdd to your .env:`);
  console.log(`  ANTHROPIC_REMOTION_SKILL_ID=${skill.id}`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});

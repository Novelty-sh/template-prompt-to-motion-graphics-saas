/**
 * Generic skill uploader — uploads a folder as a custom Agent Skill to the Anthropic API.
 *
 * Usage:
 *   npx tsx scripts/upload-skill.ts <folder-path> [display-title]
 *
 * The folder must contain a SKILL.md at its root. All files in the folder are uploaded.
 * Prints the skill_id to stdout for adding to .env.
 *
 * Examples:
 *   npx tsx scripts/upload-skill.ts ./remotion-skill "Remotion Motion Graphics"
 *   npx tsx scripts/upload-skill.ts ./clients/aiwaifu "AiWaifu Client Spec"
 */

import Anthropic, { toFile } from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

function collectFiles(
  dir: string,
  rootDir: string,
): { name: string; content: Buffer }[] {
  const results: { name: string; content: Buffer }[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, rootDir));
    } else {
      const relativePath = path.relative(rootDir, fullPath);
      results.push({ name: relativePath, content: fs.readFileSync(fullPath) });
    }
  }

  return results;
}

async function main() {
  const folderPath = process.argv[2];
  const displayTitle = process.argv[3] || path.basename(folderPath);

  if (!folderPath) {
    console.error("Usage: npx tsx scripts/upload-skill.ts <folder-path> [display-title]");
    process.exit(1);
  }

  const resolvedPath = path.resolve(folderPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Folder not found: ${resolvedPath}`);
    process.exit(1);
  }

  const skillMd = path.join(resolvedPath, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    console.error(`No SKILL.md found in ${resolvedPath}`);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const files = collectFiles(resolvedPath, resolvedPath);
  console.log(`Found ${files.length} files in ${resolvedPath}`);
  for (const f of files) {
    console.log(`  ${f.name} (${f.content.length} bytes)`);
  }

  console.log(`\nUploading skill "${displayTitle}"...`);

  // The API requires all files to share a common top-level directory prefix
  // with SKILL.md at that directory's root.
  const topDir = path.basename(resolvedPath);
  const uploadableFiles = await Promise.all(
    files.map((f) =>
      toFile(new Blob([new Uint8Array(f.content)]), `${topDir}/${f.name}`),
    ),
  );

  const skill = await client.beta.skills.create(
    { display_title: displayTitle, files: uploadableFiles },
    // @ts-expect-error — betas is valid for beta endpoints
    { betas: ["skills-2025-10-02"] },
  );

  console.log(`\nSkill uploaded successfully!`);
  console.log(`  skill_id: ${skill.id}`);
  console.log(`  version:  ${skill.latest_version}`);
  console.log(`\nAdd to your .env:`);
  console.log(`  ANTHROPIC_${displayTitle.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_SKILL_ID=${skill.id}`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});

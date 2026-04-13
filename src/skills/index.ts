import fs from "fs";
import path from "path";
import { examples } from "@/examples/code";
import { templates } from "@/templates";

// Read markdown skill files at runtime (server-side only)
const skillsDir = path.join(process.cwd(), "src", "skills");
const readSkill = (filename: string) =>
  fs.readFileSync(path.join(skillsDir, filename), "utf-8");

const threeDSkill = readSkill("3d.md");
const chartsSkill = readSkill("charts.md");
const messagingSkill = readSkill("messaging.md");
const sequencingSkill = readSkill("sequencing.md");
const socialMediaSkill = readSkill("social-media.md");
const springPhysicsSkill = readSkill("spring-physics.md");
const transitionsSkill = readSkill("transitions.md");
const typographySkill = readSkill("typography.md");

// Guidance skills (markdown files with patterns/rules)
const GUIDANCE_SKILLS = [
  "charts",
  "typography",
  "social-media",
  "messaging",
  "3d",
  "transitions",
  "sequencing",
  "spring-physics",
] as const;

// Example skills (complete working code references)
const EXAMPLE_SKILLS = [
  "example-histogram",
  "example-progress-bar",
  "example-text-rotation",
  "example-falling-spheres",
  "example-animated-shapes",
  "example-lottie",
  "example-gold-price-chart",
  "example-typewriter-highlight",
  "example-word-carousel",
] as const;

// Template skills (complete screen layouts with dynamic data slots)
const TEMPLATE_SKILLS = [
  "template-whatsapp-chat",
  "template-whatsapp-chat-light",
] as const;

export const SKILL_NAMES = [...GUIDANCE_SKILLS, ...EXAMPLE_SKILLS, ...TEMPLATE_SKILLS] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

// Map guidance skill names to imported content
const guidanceSkillContent: Record<(typeof GUIDANCE_SKILLS)[number], string> = {
  charts: chartsSkill,
  typography: typographySkill,
  "social-media": socialMediaSkill,
  messaging: messagingSkill,
  "3d": threeDSkill,
  transitions: transitionsSkill,
  sequencing: sequencingSkill,
  "spring-physics": springPhysicsSkill,
};

// Map example skill names to example IDs
const exampleIdMap: Record<(typeof EXAMPLE_SKILLS)[number], string> = {
  "example-histogram": "histogram",
  "example-progress-bar": "progress-bar",
  "example-text-rotation": "text-rotation",
  "example-falling-spheres": "falling-spheres",
  "example-animated-shapes": "animated-shapes",
  "example-lottie": "lottie-animation",
  "example-gold-price-chart": "gold-price-chart",
  "example-typewriter-highlight": "typewriter-highlight",
  "example-word-carousel": "word-carousel",
};

// Map template skill names to template IDs
const templateIdMap: Record<(typeof TEMPLATE_SKILLS)[number], string> = {
  "template-whatsapp-chat": "whatsapp-chat",
  "template-whatsapp-chat-light": "whatsapp-chat-light",
};

export function getSkillContent(skillName: SkillName): string {
  // Handle template skills - return complete template with instructions
  if (skillName.startsWith("template-")) {
    const templateId =
      templateIdMap[skillName as (typeof TEMPLATE_SKILLS)[number]];
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      const guidelinesSection = template.guidelines
        ? `\n### Visual Guidelines\n${template.guidelines}\n`
        : "";
      return `## SCREEN TEMPLATE: ${template.name}

You MUST use this template as your base. Do NOT create this UI from scratch.

### Instructions
1. Copy the template code below EXACTLY
2. Replace ONLY the DYNAMIC DATA section based on the user's prompt
3. Generate realistic, natural messages/content based on what the user asked for
4. Keep all TEMPLATE CONSTANTS and layout JSX unchanged unless the user specifically asks to modify them
${guidelinesSection}
### Dynamic Data Contract
${template.dynamicDataContract}

### Template Code
\`\`\`tsx
${template.code}
\`\`\``;
    }
    return "";
  }

  // Handle example skills - return the code directly
  if (skillName.startsWith("example-")) {
    const exampleId =
      exampleIdMap[skillName as (typeof EXAMPLE_SKILLS)[number]];
    const example = examples.find((e) => e.id === exampleId);
    if (example) {
      return `## Example: ${example.name}\n${example.description}\n\n\`\`\`tsx\n${example.code}\n\`\`\``;
    }
    return "";
  }

  // Handle guidance skills - return imported markdown content
  return (
    guidanceSkillContent[skillName as (typeof GUIDANCE_SKILLS)[number]] || ""
  );
}

export function getCombinedSkillContent(skills: SkillName[]): string {
  if (skills.length === 0) {
    return "";
  }

  const contents = skills
    .map((skill) => getSkillContent(skill))
    .filter((content) => content.length > 0);

  return contents.join("\n\n---\n\n");
}

export const SKILL_DETECTION_PROMPT = `Classify this motion graphics prompt into ALL applicable categories.
A prompt can match multiple categories. Only include categories that are clearly relevant.

Guidance categories (patterns and rules):
- charts: data visualizations, graphs, histograms, bar charts, pie charts, progress bars, statistics, metrics
- typography: kinetic text, typewriter effects, text animations, word carousels, animated titles, text-heavy content
- social-media: Instagram stories, TikTok content, YouTube shorts, social media posts, reels, vertical video
- messaging: chat interfaces, WhatsApp conversations, iMessage, chat bubbles, text messages, DMs, messenger
- 3d: 3D objects, ThreeJS, spatial animations, rotating cubes, 3D scenes
- transitions: scene changes, fades between clips, slide transitions, wipes, multiple scenes
- sequencing: multiple elements appearing at different times, staggered animations, choreographed entrances
- spring-physics: bouncy animations, organic motion, elastic effects, overshoot animations

Code examples (complete working references):
- example-histogram: animated bar chart with spring animations and @remotion/shapes
- example-progress-bar: loading bar animation from 0 to 100%
- example-text-rotation: rotating words with fade/blur transitions
- example-falling-spheres: 3D bouncing spheres with ThreeJS and physics simulation
- example-animated-shapes: bouncing/rotating SVG shapes (circle, triangle, rect, star)
- example-lottie: loading and displaying Lottie animations from URL
- example-gold-price-chart: bar chart with Y-axis labels, monthly data, staggered animations
- example-typewriter-highlight: typewriter effect with cursor blink, pause, and word highlight
- example-word-carousel: rotating words with crossfade and blur transitions

Screen templates (complete UI layouts — use the template code as-is, only fill in dynamic data):
- template-whatsapp-chat: WhatsApp dark theme chat, dark mode WhatsApp, dark background chat
- template-whatsapp-chat-light: WhatsApp light theme chat, WhatsApp mobile, WhatsApp white theme, standard WhatsApp. This is the DEFAULT WhatsApp template — use this unless the user specifically asks for dark theme.

IMPORTANT: When a template matches, ALWAYS include it. Templates take priority — if the user asks for a "WhatsApp chat", include the appropriate template even if other categories also match. Only include ONE template (not both). Default to light theme unless dark is requested.

Return an array of matching category names. Return an empty array if none apply.`;

import Anthropic from "@anthropic-ai/sdk";

// Singleton client — initialized once per server lifecycle
let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'The environment variable "ANTHROPIC_API_KEY" is not set. Add it to your .env file.',
      );
    }
    _client = new Anthropic({
      apiKey,
      defaultHeaders: {
        "anthropic-beta": SKILLS_BETAS.join(","),
      },
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

/** Maps our friendly model IDs to Anthropic API model strings. */
const MODEL_MAP: Record<string, string> = {
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-opus-4-6": "claude-opus-4-6",
};

export interface ResolvedModel {
  modelId: string;
  thinking: boolean;
}

/** Parse "claude-sonnet-4-6:thinking" → { modelId, thinking } */
export function resolveModel(friendlyId: string): ResolvedModel {
  const [base, variant] = friendlyId.split(":");
  const modelId = MODEL_MAP[base] ?? base;
  return { modelId, thinking: variant === "thinking" };
}

/** Cheap model for utility calls (validation, mode routing). */
export const UTILITY_MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export interface SkillRef {
  type: "custom" | "anthropic";
  skill_id: string;
  version: string;
}

/**
 * Build the skills array for a request.
 * Always includes the Remotion skill; optionally adds client/domain skills.
 */
export function getSkillsForRequest(options?: {
  clientSkillId?: string;
  extraSkillIds?: string[];
}): SkillRef[] {
  const remotionSkillId = process.env.ANTHROPIC_REMOTION_SKILL_ID;

  const skills: SkillRef[] = [];

  if (remotionSkillId) {
    skills.push({ type: "custom", skill_id: remotionSkillId, version: "latest" });
  } else {
    console.warn(
      'ANTHROPIC_REMOTION_SKILL_ID is not set — generating without Remotion skills. Run "npx tsx scripts/upload-remotion-skill.ts" to fix.',
    );
  }

  if (options?.clientSkillId) {
    skills.push({
      type: "custom",
      skill_id: options.clientSkillId,
      version: "latest",
    });
  }

  if (options?.extraSkillIds) {
    for (const id of options.extraSkillIds) {
      skills.push({ type: "custom", skill_id: id, version: "latest" });
    }
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Betas & tools required for Agent Skills
// ---------------------------------------------------------------------------

export const SKILLS_BETAS = [
  "code-execution-2025-08-25",
  "skills-2025-10-02",
] as const;

export const CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825" as const,
  name: "code_execution" as const,
};

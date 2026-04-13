/**
 * Structured output helper for the Anthropic API.
 *
 * Uses tool_use with tool_choice to force Claude to return JSON matching
 * a given schema — equivalent to Vercel AI SDK's generateObject().
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getClient, UTILITY_MODEL } from "./anthropic";

interface StructuredOptions {
  /** Anthropic model ID. Defaults to UTILITY_MODEL (Haiku). */
  model?: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  /** JSON Schema for the output. */
  schema: Record<string, unknown>;
  /** Tool name (used internally for tool_choice). */
  toolName?: string;
  /** Tool description shown to the model. */
  toolDescription?: string;
}

/**
 * Generate a structured JSON object from Claude.
 * Wraps the schema as a tool and forces the model to call it.
 */
export async function generateStructured<T>(
  options: StructuredOptions,
): Promise<T> {
  const {
    model = UTILITY_MODEL,
    system,
    messages,
    schema,
    toolName = "respond",
    toolDescription = "Provide your response in the required format.",
  } = options;

  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages,
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: schema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: toolName },
  });

  // Extract the tool input from the response
  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolBlock) {
    throw new Error("Model did not return structured output");
  }

  return toolBlock.input as T;
}

// ---------------------------------------------------------------------------
// JSON Schema definitions for existing Zod schemas
// (Converted from the Zod schemas in route.ts to plain JSON Schema)
// ---------------------------------------------------------------------------

export const ValidationSchema = {
  type: "object" as const,
  properties: {
    valid: {
      type: "boolean" as const,
      description: "Whether the prompt is valid for motion graphics generation",
    },
  },
  required: ["valid"],
};

export const ModeRoutingSchema = {
  type: "object" as const,
  properties: {
    mode: {
      type: "string" as const,
      enum: ["image_base", "react_reconstruct"],
      description:
        "image_base: animate on top of image. react_reconstruct: rebuild UI as React code.",
    },
  },
  required: ["mode"],
};

export const FollowUpResponseJsonSchema = {
  type: "object" as const,
  properties: {
    type: {
      type: "string" as const,
      enum: ["edit", "full"],
      description:
        'Use "edit" for small targeted changes, "full" for major restructuring',
    },
    summary: {
      type: "string" as const,
      description:
        "A brief 1-sentence summary of what changes were made",
    },
    edits: {
      type: ["array", "null"] as unknown as "array",
      items: {
        type: "object" as const,
        properties: {
          description: {
            type: "string" as const,
            description: "Brief description of this edit",
          },
          old_string: {
            type: "string" as const,
            description: "The exact string to find (must match exactly)",
          },
          new_string: {
            type: "string" as const,
            description: "The replacement string",
          },
        },
        required: ["description", "old_string", "new_string"],
      },
      description:
        'Required when type is "edit": array of search-replace operations. Null when type is "full".',
    },
    code: {
      type: ["string", "null"] as unknown as "string",
      description:
        'Required when type is "full": the complete replacement code. Null when type is "edit".',
    },
  },
  required: ["type", "summary", "edits", "code"],
};

/**
 * Uses Claude's native text editor tool (str_replace_based_edit_tool) for
 * follow-up code edits. Claude is fine-tuned for this tool, so it produces
 * much more accurate old_str/new_str matches than generic structured output.
 *
 * Runs a multi-turn tool-use loop against in-memory code (no real filesystem).
 */

import Anthropic from "@anthropic-ai/sdk";

// Singleton client for text-editor calls (no beta headers needed)
let _editorClient: Anthropic | null = null;

function getEditorClient(): Anthropic {
  if (!_editorClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set — required for text editor tool.");
    }
    _editorClient = new Anthropic({ apiKey });
  }
  return _editorClient;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditOperation {
  description: string;
  old_string: string;
  new_string: string;
  lineNumber?: number;
}

export interface EditorResult {
  code: string;
  summary: string;
  edits: EditOperation[];
  editType: "tool_edit" | "full_replacement";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

const VIRTUAL_PATH = "animation.tsx";

function toAnthropicImageBlock(img: string): Anthropic.ImageBlockParam | null {
  if (img.startsWith("data:")) {
    const match = img.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const [, mediaType, data] = match;
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data,
      },
    };
  }
  if (img.startsWith("http")) {
    return { type: "image", source: { type: "url", url: img } };
  }
  return null;
}

export async function editWithTextEditor(opts: {
  currentCode: string;
  prompt: string;
  systemPrompt: string;
  model: string;
  conversationContext?: string;
  manualEditNotice?: string;
  errorCorrectionNotice?: string;
  frameImages?: string[];
}): Promise<EditorResult> {
  const client = getEditorClient();

  let code = opts.currentCode;
  const edits: EditOperation[] = [];
  let summary = "";

  // Build user message with all context
  const userText = [
    `The file \`${VIRTUAL_PATH}\` contains the current animation code.`,
    opts.conversationContext || "",
    opts.manualEditNotice || "",
    opts.errorCorrectionNotice || "",
    `\nUser request: ${opts.prompt}`,
    opts.frameImages && opts.frameImages.length > 0
      ? `\n(The user attached ${opts.frameImages.length} image${opts.frameImages.length > 1 ? "s" : ""} — see below.)`
      : "",
    `\nUse the text editor tool to make changes to \`${VIRTUAL_PATH}\`.`,
  ]
    .filter(Boolean)
    .join("\n");

  const imageBlocks = (opts.frameImages ?? [])
    .map((img) => toAnthropicImageBlock(img))
    .filter((b): b is Anthropic.ImageBlockParam => b !== null);

  const initialContent: Anthropic.ContentBlockParam[] =
    imageBlocks.length > 0
      ? [...imageBlocks, { type: "text", text: userText }]
      : [{ type: "text", text: userText }];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: initialContent },
  ];

  const MAX_TURNS = 10;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: opts.model,
      max_tokens: 16384,
      system: opts.systemPrompt,
      tools: [
        {
          type: "text_editor_20250728",
          name: "str_replace_based_edit_tool",
        },
      ],
      messages,
    });

    // Collect text blocks for the summary
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        summary = block.text;
      }
    }

    // Find tool_use blocks
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // No tool calls → Claude is done
    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    // Process each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const input = toolUse.input as Record<string, unknown>;
      const command = input.command as string;

      if (command === "view") {
        // Return code with line numbers (as the docs recommend)
        const numbered = code
          .split("\n")
          .map((line, i) => `${i + 1}: ${line}`)
          .join("\n");
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: numbered,
        });
      } else if (command === "str_replace") {
        const oldStr = input.old_str as string;
        const newStr = input.new_str as string;

        if (!code.includes(oldStr)) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content:
              "Error: No match found for replacement text. Please check your text and try again.",
            is_error: true,
          });
        } else {
          const matchCount = code.split(oldStr).length - 1;
          if (matchCount > 1) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Error: Found ${matchCount} matches for replacement text. Please provide more context to make a unique match.`,
              is_error: true,
            });
          } else {
            const lineNumber = code
              .substring(0, code.indexOf(oldStr))
              .split("\n").length;
            code = code.replace(oldStr, newStr);
            edits.push({
              description: `Edit at line ${lineNumber}`,
              old_string: oldStr,
              new_string: newStr,
              lineNumber,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: "Successfully replaced text at exactly one location.",
            });
          }
        }
      } else if (command === "create") {
        // Full file rewrite
        code = input.file_text as string;
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "File created successfully.",
        });
      } else if (command === "insert") {
        const insertLine = input.insert_line as number;
        const insertText = input.insert_text as string;
        const lines = code.split("\n");
        lines.splice(insertLine, 0, ...insertText.split("\n"));
        code = lines.join("\n");
        edits.push({
          description: `Insert at line ${insertLine}`,
          old_string: "",
          new_string: insertText,
          lineNumber: insertLine,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Text inserted successfully.",
        });
      }
    }

    // Append assistant turn + tool results for next iteration
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  // Determine edit type
  const isFullReplacement = edits.length === 0 && code !== opts.currentCode;

  return {
    code,
    summary: summary || "Applied edits",
    edits,
    editType: isFullReplacement ? "full_replacement" : "tool_edit",
  };
}

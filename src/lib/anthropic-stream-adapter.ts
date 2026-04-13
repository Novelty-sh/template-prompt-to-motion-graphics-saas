/**
 * Translates an Anthropic SDK message stream into the SSE format
 * that useGenerationApi.ts expects on the client.
 *
 * Client-expected events:
 *   data: {"type":"metadata","skills":[],"frameMode":null}
 *   data: {"type":"reasoning-start"}
 *   data: {"type":"text-start"}
 *   data: {"type":"text-delta","delta":"..."}
 *   data: [DONE]
 *
 * Anthropic stream events we care about:
 *   content_block_start  (type = "thinking" | "text" | "tool_use" | ...)
 *   content_block_delta  (delta.type = "thinking_delta" | "text_delta" | ...)
 *   content_block_stop
 *   message_delta        (stop_reason)
 *   message_stop
 *
 * Code execution blocks (from skills) and tool_use blocks are silently skipped.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStream } from "@anthropic-ai/sdk/lib/BetaMessageStream";
import {
  CODE_EXECUTION_TOOL,
  getClient,
  type SkillRef,
} from "./anthropic";

interface StreamMetadata {
  skills?: string[];
  frameMode?: "image_base" | "react_reconstruct" | null;
}

interface PauseTurnContext {
  model: string;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  skills: SkillRef[];
  thinking: boolean;
  thinkingBudget: number;
}

/**
 * Create a ReadableStream that emits SSE events from an Anthropic message stream.
 * Handles pause_turn by transparently continuing the conversation.
 */
export function createAnthropicSSEStream(
  stream: BetaMessageStream,
  metadata: StreamMetadata,
  pauseTurnContext: PauseTurnContext,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const MAX_CONTINUATIONS = 10;

  return new ReadableStream({
    async start(controller) {
      function emit(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send metadata event first
      emit(JSON.stringify({ type: "metadata", ...metadata }));

      let continuations = 0;
      let hasEmittedTextStart = false;
      let hasEmittedReasoningStart = false;

      // Track accumulated content for pause_turn continuations
      let accumulatedContent: Anthropic.Beta.BetaContentBlockParam[] = [];

      async function processStream(activeStream: BetaMessageStream) {
        for await (const event of activeStream) {
          if (event.type === "content_block_start") {
            const block = event.content_block;
            if (block.type === "thinking" && !hasEmittedReasoningStart) {
              emit(JSON.stringify({ type: "reasoning-start" }));
              hasEmittedReasoningStart = true;
            } else if (block.type === "text" && !hasEmittedTextStart) {
              emit(JSON.stringify({ type: "text-start" }));
              hasEmittedTextStart = true;
            }
            // tool_use, code_execution → skip silently
          } else if (event.type === "content_block_delta") {
            const delta = event.delta;
            if ("text" in delta) {
              emit(
                JSON.stringify({
                  type: "text-delta",
                  delta: (delta as { text: string }).text,
                }),
              );
            }
            // thinking_delta, input_json_delta → skip
          } else if (event.type === "message_delta") {
            if (event.delta.stop_reason === "pause_turn") {
              // Claude paused for code execution — continue transparently
              if (continuations >= MAX_CONTINUATIONS) {
                emit(
                  JSON.stringify({
                    type: "error",
                    error: "Too many skill execution rounds",
                  }),
                );
                break;
              }
              continuations++;

              // Get the final message to extract accumulated content
              const finalMessage = await activeStream.finalMessage();

              // Build continuation content from the assistant's response
              accumulatedContent = finalMessage.content.map(
                (block: Anthropic.Beta.BetaContentBlock) => {
                  if (block.type === "text") {
                    return { type: "text" as const, text: block.text };
                  }
                  if (block.type === "thinking") {
                    return {
                      type: "thinking" as const,
                      thinking: block.thinking,
                      signature: block.signature,
                    };
                  }
                  if (block.type === "tool_use") {
                    return {
                      type: "tool_use" as const,
                      id: block.id,
                      name: block.name,
                      input: block.input,
                    };
                  }
                  // For other block types, cast through
                  return block as unknown as Anthropic.Beta.BetaContentBlockParam;
                },
              );

              // Build tool results for any tool_use blocks
              const toolResults: Anthropic.Beta.BetaMessageParam[] = [];
              for (const block of finalMessage.content) {
                if (block.type === "tool_use") {
                  toolResults.push({
                    role: "user",
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: "Continue.",
                      },
                    ],
                  });
                }
              }

              // Continue the conversation with the same container
              const client = getClient();
              const continueMessages: Anthropic.Beta.BetaMessageParam[] = [
                ...pauseTurnContext.messages,
                { role: "assistant", content: accumulatedContent },
                ...toolResults,
              ];

              const thinkingParam = pauseTurnContext.thinking
                ? {
                    thinking: {
                      type: "enabled" as const,
                      budget_tokens: pauseTurnContext.thinkingBudget,
                    },
                  }
                : {};

              const nextStream = client.beta.messages.stream({
                model: pauseTurnContext.model,
                max_tokens: 16384,
                system: pauseTurnContext.system,
                messages: continueMessages,
                container: {
                  id: finalMessage.container?.id,
                  skills: pauseTurnContext.skills,
                },
                tools: [CODE_EXECUTION_TOOL],
                ...thinkingParam,
              });

              // Process the continuation stream
              await processStream(nextStream);
              return; // Don't continue this stream's loop
            }
          }
          // message_stop → handled after loop
        }
      }

      try {
        await processStream(stream);
        emit("[DONE]");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        emit(JSON.stringify({ type: "error", error: msg }));
      } finally {
        controller.close();
      }
    },
  });
}

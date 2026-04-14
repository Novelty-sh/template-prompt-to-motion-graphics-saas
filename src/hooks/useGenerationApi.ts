import {
  extractComponentCode,
  stripMarkdownFences,
  validateGptResponse,
} from "@/helpers/sanitize-response";
import { uploadImagesToGCS } from "@/lib/upload-image";
import type {
  AssistantMetadata,
  ConversationContextMessage,
  ErrorCorrectionContext,
} from "@/types/conversation";
import type {
  AspectRatio,
  GenerationErrorType,
  ModelId,
  StreamPhase,
} from "@/types/generation";
import { useCallback, useState } from "react";

interface FailedEditInfo {
  description: string;
  old_string: string;
  new_string: string;
}

interface GenerationCallbacks {
  onCodeGenerated?: (code: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onStreamPhaseChange?: (phase: StreamPhase) => void;
  onError?: (
    error: string,
    type: GenerationErrorType,
    failedEdit?: FailedEditInfo,
  ) => void;
  onMessageSent?: (prompt: string, attachedImages?: string[]) => void;
  onGenerationComplete?: (
    code: string,
    summary?: string,
    metadata?: AssistantMetadata,
  ) => void;
  onErrorMessage?: (
    message: string,
    errorType: "edit_failed" | "api" | "validation",
    failedEdit?: FailedEditInfo,
  ) => void;
  onPendingMessage?: (skills?: string[]) => void;
  onClearPendingMessage?: () => void;
}

interface GenerationContext {
  currentCode?: string;
  conversationHistory: ConversationContextMessage[];
  previouslyUsedSkills: string[];
  isFollowUp: boolean;
  hasManualEdits: boolean;
  errorCorrection?: ErrorCorrectionContext;
  frameImages?: string[];
  aspectRatio?: AspectRatio;
}

interface UseGenerationApiReturn {
  isLoading: boolean;
  runGeneration: (
    prompt: string,
    model: ModelId,
    context: GenerationContext,
    callbacks: GenerationCallbacks,
    options?: { silent?: boolean },
  ) => Promise<void>;
}

/** Replace the __BASE_FRAME__ placeholder with the actual base64 image data URL. */
function injectBaseFrame(code: string, frameImages: string[] | undefined): string {
  if (!frameImages?.length || !code.includes('"__BASE_FRAME__"')) return code;
  return code.replace('"__BASE_FRAME__"', `"${frameImages[0]}"`);
}

export function useGenerationApi(): UseGenerationApiReturn {
  const [isLoading, setIsLoading] = useState(false);

  const runGeneration = useCallback(
    async (
      prompt: string,
      model: ModelId,
      context: GenerationContext,
      callbacks: GenerationCallbacks,
      options?: { silent?: boolean },
    ) => {
      if (!prompt.trim() || isLoading) return;

      const {
        currentCode,
        conversationHistory,
        previouslyUsedSkills,
        isFollowUp,
        hasManualEdits,
        errorCorrection,
        frameImages,
        aspectRatio,
      } = context;

      const {
        onCodeGenerated,
        onStreamingChange,
        onStreamPhaseChange,
        onError,
        onMessageSent,
        onGenerationComplete,
        onErrorMessage,
        onPendingMessage,
        onClearPendingMessage,
      } = callbacks;

      setIsLoading(true);
      onStreamingChange?.(true);
      onStreamPhaseChange?.("reasoning");

      // Upload images to GCS first so we send URLs instead of base64
      let imageUrls: string[] | undefined;
      if (frameImages && frameImages.length > 0) {
        try {
          const sessionId = `session-${Date.now()}`;
          imageUrls = await uploadImagesToGCS(frameImages, sessionId);
        } catch (err) {
          console.error("Image upload failed:", err);
          const msg =
            err instanceof Error ? err.message : "Failed to upload images";
          onError?.(msg, "api");
          onErrorMessage?.(`Image upload failed: ${msg}`, "api");
          setIsLoading(false);
          onStreamingChange?.(false);
          onStreamPhaseChange?.("idle");
          onClearPendingMessage?.();
          return;
        }
      }

      // Only add user message if not a silent retry
      // Use CDN URLs for chat history so payloads stay small on future requests
      if (!options?.silent) {
        onMessageSent?.(prompt, imageUrls ?? frameImages);
      }

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            model,
            currentCode: isFollowUp ? currentCode : undefined,
            conversationHistory: isFollowUp ? conversationHistory : [],
            previouslyUsedSkills: isFollowUp ? previouslyUsedSkills : [],
            isFollowUp,
            hasManualEdits,
            errorCorrection,
            frameImages: imageUrls ?? frameImages,
            aspectRatio,
          }),
        });

        if (!response.ok) {
          // Handle non-JSON error responses (e.g. Vercel 413 HTML page)
          let errorData: Record<string, string> = {};
          const errContentType = response.headers.get("content-type") || "";
          if (errContentType.includes("application/json")) {
            errorData = await response.json().catch(() => ({}));
          }

          if (errorData.error) {
            const errorMessage = errorData.error;
            if (errorData.type === "edit_failed") {
              onError?.(errorMessage, "validation", errorData.failedEdit as unknown as FailedEditInfo);
              onErrorMessage?.(errorMessage, "edit_failed", errorData.failedEdit as unknown as FailedEditInfo);
              return;
            }
            if (errorData.type === "validation") {
              onError?.(errorMessage, "validation");
              onErrorMessage?.(errorMessage, "validation");
              return;
            }
            throw new Error(errorMessage);
          }

          // Friendly messages for common HTTP errors
          if (response.status === 413) {
            throw new Error(
              "Request too large — please use smaller images or fewer attachments.",
            );
          }
          throw new Error(
            `Something went wrong (${response.status}). Please try again.`,
          );
        }

        const contentType = response.headers.get("content-type") || "";

        // Handle JSON response (non-streaming, for follow-up edits)
        if (contentType.includes("application/json")) {
          const data = await response.json();
          const { summary, metadata } = data;
          const code = injectBaseFrame(data.code, imageUrls ?? frameImages);
          onCodeGenerated?.(code);
          onGenerationComplete?.(code, summary, metadata);
          const validation = validateGptResponse(code);
          if (!validation.isValid && validation.error) {
            onError?.(validation.error, "validation");
          }
          return;
        }

        // Handle SSE stream response
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedText = "";
        let buffer = "";
        let streamMetadata: AssistantMetadata = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (event.type === "metadata") {
                streamMetadata = {
                  ...streamMetadata,
                  skills: event.skills,
                };
                onPendingMessage?.(event.skills);
              } else if (event.type === "reasoning-start") {
                onStreamPhaseChange?.("reasoning");
              } else if (event.type === "text-start") {
                onStreamPhaseChange?.("generating");
              } else if (event.type === "text-delta") {
                accumulatedText += event.delta;
                const codeToShow = stripMarkdownFences(accumulatedText);
                onCodeGenerated?.(codeToShow);
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseError) {
              if (
                parseError instanceof Error &&
                parseError.message !== "Unexpected token"
              ) {
                throw parseError;
              }
            }
          }
        }

        let finalCode = stripMarkdownFences(accumulatedText);
        finalCode = extractComponentCode(finalCode);
        finalCode = injectBaseFrame(finalCode, imageUrls ?? frameImages);
        onCodeGenerated?.(finalCode);
        onClearPendingMessage?.();
        onGenerationComplete?.(
          finalCode,
          undefined,
          streamMetadata.skills?.length ? streamMetadata : undefined,
        );

        const validation = validateGptResponse(finalCode);
        if (!validation.isValid && validation.error) {
          onError?.(validation.error, "validation");
        }
      } catch (error) {
        console.error("Error generating code:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        onError?.(errorMessage, "api");
      } finally {
        setIsLoading(false);
        onStreamingChange?.(false);
        onStreamPhaseChange?.("idle");
        onClearPendingMessage?.();
      }
    },
    [isLoading],
  );

  return {
    isLoading,
    runGeneration,
  };
}

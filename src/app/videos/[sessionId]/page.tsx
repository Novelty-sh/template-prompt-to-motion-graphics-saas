"use client";

import { AnimationPlayer } from "@/components/AnimationPlayer";
import { ChatSidebar, type ChatSidebarRef } from "@/components/ChatSidebar";
import { CodeEditor } from "@/components/CodeEditor";
import { PageLayout } from "@/components/PageLayout";
import { TabPanel } from "@/components/TabPanel";
import { examples } from "@/examples/code";
import { useAnimationState } from "@/hooks/useAnimationState";
import { useAutoCorrection } from "@/hooks/useAutoCorrection";
import { useConversationState } from "@/hooks/useConversationState";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { supabase } from "@/lib/supabase";
import type {
  AssistantMetadata,
  EditOperation,
  ErrorCorrectionContext,
} from "@/types/conversation";
import type { AspectRatio, GenerationErrorType, ModelId, StreamPhase } from "@/types/generation";
import { Loader2 } from "lucide-react";
import type { NextPage } from "next";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

const MAX_CORRECTION_ATTEMPTS = 3;
const PENDING_PROMPT_KEY = "session_pending_prompt";
const PENDING_MODEL_KEY = "session_pending_model";
const PENDING_IMAGES_KEY = "session_pending_images";
const PENDING_ASPECT_RATIO_KEY = "session_pending_aspect_ratio";

function VideoPageContent() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [durationInFrames, setDurationInFrames] = useState(
    examples[0]?.durationInFrames || 150,
  );
  const [fps, setFps] = useState(examples[0]?.fps || 30);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const [prompt, setPrompt] = useState("");
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [generationError, setGenerationError] = useState<{
    message: string;
    type: GenerationErrorType;
    failedEdit?: EditOperation;
  } | null>(null);
  const [errorCorrection, setErrorCorrection] =
    useState<ErrorCorrectionContext | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sessionModel, setSessionModel] = useState<ModelId | undefined>(undefined);
  // Initialize directly from sessionStorage so new sessions start at the right ratio immediately
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => {
    if (typeof window === "undefined") return "16:9";
    return (sessionStorage.getItem(PENDING_ASPECT_RATIO_KEY) as AspectRatio) || "16:9";
  });

  const {
    messages,
    hasManualEdits,
    pendingMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    markManualEdit,
    initializeFromSnapshots,
    getFullContext,
    getPreviouslyUsedSkills,
    getLastUserAttachedImages,
    setPendingMessage,
    clearPendingMessage,
    isFirstGeneration,
  } = useConversationState();

  const {
    snapshots,
    isLoaded,
    latestCode,
    canUndo,
    canRedo,
    saveSnapshot,
    undo,
    redo,
  } = useSessionHistory(sessionId);

  const {
    code,
    Component,
    error: compilationError,
    isCompiling,
    setCode,
    compileCode,
  } = useAnimationState("");

  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const codeError = compilationError || runtimeError;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(isStreaming);
  const codeRef = useRef(code);
  const chatSidebarRef = useRef<ChatSidebarRef>(null);

  const { markAsAiGenerated, markAsUserEdited } = useAutoCorrection({
    maxAttempts: MAX_CORRECTION_ATTEMPTS,
    compilationError: codeError,
    generationError,
    isStreaming,
    isCompiling,
    hasGeneratedOnce,
    code,
    errorCorrection,
    onTriggerCorrection: useCallback(
      (correctionPrompt: string, context: ErrorCorrectionContext) => {
        setErrorCorrection(context);
        setPrompt(correctionPrompt);
        const lastImages = getLastUserAttachedImages();
        setTimeout(() => {
          chatSidebarRef.current?.triggerGeneration({
            silent: true,
            attachedImages: lastImages,
          });
        }, 100);
      },
      [getLastUserAttachedImages],
    ),
    onAddErrorMessage: addErrorMessage,
    onClearGenerationError: useCallback(() => setGenerationError(null), []),
    onClearErrorCorrection: useCallback(() => setErrorCorrection(null), []),
  });

  // Sync refs
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      markAsAiGenerated();
      compileCode(codeRef.current);
    }
  }, [isStreaming, compileCode, markAsAiGenerated]);

  // Load session metadata on mount
  useEffect(() => {
    supabase
      .from("sessions")
      .select("model, aspect_ratio")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (data?.model) setSessionModel(data.model as ModelId);
        if (data?.aspect_ratio) setAspectRatio(data.aspect_ratio as AspectRatio);
      });
  }, [sessionId]);

  // Restore session or auto-generate once history is loaded
  useEffect(() => {
    if (!isLoaded || hasAutoStarted) return;
    setHasAutoStarted(true);

    if (latestCode && snapshots.length > 0) {
      // Restore previous session
      initializeFromSnapshots(snapshots);
      setCode(latestCode);
      compileCode(latestCode);
      setHasGeneratedOnce(true);
      return;
    }

    // New session — read pending prompt/settings from sessionStorage
    const pendingPrompt = sessionStorage.getItem(PENDING_PROMPT_KEY);
    const pendingImages = sessionStorage.getItem(PENDING_IMAGES_KEY);
    const pendingAspectRatio = sessionStorage.getItem(PENDING_ASPECT_RATIO_KEY) as AspectRatio | null;
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
    sessionStorage.removeItem(PENDING_MODEL_KEY);
    sessionStorage.removeItem(PENDING_IMAGES_KEY);
    sessionStorage.removeItem(PENDING_ASPECT_RATIO_KEY);

    if (pendingAspectRatio) {
      setAspectRatio(pendingAspectRatio);
    }

    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      let storedImages: string[] | undefined;
      if (pendingImages) {
        try {
          storedImages = JSON.parse(pendingImages);
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        chatSidebarRef.current?.triggerGeneration({ attachedImages: storedImages });
      }, 100);
    }
  }, [isLoaded, hasAutoStarted, latestCode, snapshots, initializeFromSnapshots, setCode, compileCode]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setHasGeneratedOnce(true);
      if (!isStreamingRef.current) {
        markManualEdit(newCode);
        markAsUserEdited();
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (isStreamingRef.current) return;
      debounceRef.current = setTimeout(() => {
        compileCode(newCode);
      }, 500);
    },
    [setCode, compileCode, markManualEdit, markAsUserEdited],
  );

  const handleMessageSent = useCallback(
    (promptText: string, attachedImages?: string[]) => {
      addUserMessage(promptText, attachedImages);
    },
    [addUserMessage],
  );

  const handleGenerationComplete = useCallback(
    (generatedCode: string, summary?: string, metadata?: AssistantMetadata) => {
      const content = summary || "Generated your animation, any follow up edits?";
      addAssistantMessage(content, generatedCode, metadata);
      markAsAiGenerated();
      saveSnapshot(generatedCode, prompt, summary || "", metadata?.skills ?? []);
    },
    [addAssistantMessage, markAsAiGenerated, saveSnapshot, prompt],
  );

  const handleUndo = useCallback(() => {
    const prevCode = undo();
    if (prevCode) {
      setCode(prevCode);
      compileCode(prevCode);
    }
  }, [undo, setCode, compileCode]);

  const handleRedo = useCallback(() => {
    const nextCode = redo();
    if (nextCode) {
      setCode(nextCode);
      compileCode(nextCode);
    }
  }, [redo, setCode, compileCode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleStreamingChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
    if (streaming) {
      setGenerationError(null);
      setRuntimeError(null);
      setErrorCorrection(null);
    }
  }, []);

  const handleError = useCallback(
    (message: string, type: GenerationErrorType, failedEdit?: EditOperation) => {
      setGenerationError({ message, type, failedEdit });
    },
    [],
  );

  const handleRuntimeError = useCallback((errorMessage: string) => {
    setRuntimeError(errorMessage);
  }, []);

  return (
    <PageLayout showLogoAsLink>
      <div className="flex-1 flex flex-col min-[1000px]:flex-row min-w-0 overflow-hidden">
        <ChatSidebar
          ref={chatSidebarRef}
          messages={messages}
          pendingMessage={pendingMessage}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          hasManualEdits={hasManualEdits}
          onCodeGenerated={handleCodeChange}
          onStreamingChange={handleStreamingChange}
          onStreamPhaseChange={setStreamPhase}
          onError={handleError}
          prompt={prompt}
          onPromptChange={setPrompt}
          currentCode={code}
          conversationHistory={getFullContext()}
          previouslyUsedSkills={getPreviouslyUsedSkills()}
          isFollowUp={!isFirstGeneration}
          onMessageSent={handleMessageSent}
          onGenerationComplete={handleGenerationComplete}
          onErrorMessage={addErrorMessage}
          errorCorrection={errorCorrection ?? undefined}
          onPendingMessage={setPendingMessage}
          onClearPendingMessage={clearPendingMessage}
          Component={Component}
          fps={fps}
          durationInFrames={durationInFrames}
          currentFrame={currentFrame}
          defaultModel={sessionModel}
          aspectRatio={aspectRatio}
        />

        <div className="flex-1 flex flex-col min-w-0 pr-12 pb-8 overflow-hidden">
          <TabPanel
            codeContent={
              <CodeEditor
                code={hasGeneratedOnce && !generationError ? code : ""}
                onChange={handleCodeChange}
                isStreaming={isStreaming}
                streamPhase={streamPhase}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            }
            previewContent={
              <AnimationPlayer
                Component={generationError ? null : Component}
                durationInFrames={durationInFrames}
                fps={fps}
                onDurationChange={setDurationInFrames}
                onFpsChange={setFps}
                isCompiling={isCompiling}
                isStreaming={isStreaming}
                error={generationError?.message || codeError}
                errorType={generationError?.type || "compilation"}
                code={code}
                onRuntimeError={handleRuntimeError}
                onFrameChange={setCurrentFrame}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
              />
            }
          />
        </div>
      </div>
    </PageLayout>
  );
}

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-foreground" />
    </div>
  );
}

const VideoPage: NextPage = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VideoPageContent />
    </Suspense>
  );
};

export default VideoPage;

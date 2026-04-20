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
import { clearPendingImages, pendingImages as homePendingImages } from "@/app/page";
import type { AspectRatio, GenerationErrorType, ModelId, StreamPhase } from "@/types/generation";
import { Loader2 } from "lucide-react";
import type { NextPage } from "next";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

const MAX_CORRECTION_ATTEMPTS = 3;
const PENDING_PROMPT_KEY = "session_pending_prompt";
const PENDING_MODEL_KEY = "session_pending_model";
const PENDING_ASPECT_RATIO_KEY = "session_pending_aspect_ratio";

function VideoPageContent() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [durationInFrames, setDurationInFrames] = useState(
    examples[0]?.durationInFrames || 150,
  );
  const [fps, setFps] = useState(examples[0]?.fps || 30);

  // Once the user manually changes duration, we stop letting __setDuration
  // reports from the compiled component overwrite it. Flag persists in Supabase
  // so the choice survives a refresh.
  const durationOverrideRef = useRef(false);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSettings = useCallback(
    (patch: { duration_in_frames?: number; fps?: number; duration_override?: boolean }) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(async () => {
        const { error } = await supabase.from("sessions").update(patch).eq("id", sessionId);
        if (error) console.error("Failed to persist session settings:", error);
      }, 400);
    },
    [sessionId],
  );

  // User edit from the Settings modal: wins, locks out auto-follow.
  const handleDurationChange = useCallback(
    (n: number) => {
      durationOverrideRef.current = true;
      setDurationInFrames((prev) => {
        if (prev === n) return prev;
        persistSettings({ duration_in_frames: n, duration_override: true });
        return n;
      });
    },
    [persistSettings],
  );

  // Auto-follow from __setDuration: skip if user already overrode.
  const handleReportDuration = useCallback(
    (n: number) => {
      if (durationOverrideRef.current) return;
      setDurationInFrames((prev) => {
        if (prev === n) return prev;
        persistSettings({ duration_in_frames: n });
        return n;
      });
    },
    [persistSettings],
  );

  const handleFpsChange = useCallback(
    (n: number) => {
      setFps((prev) => {
        if (prev === n) return prev;
        persistSettings({ fps: n });
        return n;
      });
    },
    [persistSettings],
  );
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
  const [seedTemplateId, setSeedTemplateId] = useState<string | null>(null);
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

  // Options passed to every compile — lets the component auto-report its natural
  // duration back up to state via the __setDuration hook. Goes through
  // handleReportDuration so it respects the user-override flag.
  const compileOptions = useRef({
    onReportDuration: (n: number) => handleReportDuration(n),
  });
  compileOptions.current.onReportDuration = (n: number) => handleReportDuration(n);

  // Sync refs
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      markAsAiGenerated();
      compileCode(codeRef.current, compileOptions.current);
    }
  }, [isStreaming, compileCode, markAsAiGenerated]);

  // Load session metadata on mount
  useEffect(() => {
    supabase
      .from("sessions")
      .select("model, aspect_ratio, fps, duration_in_frames, duration_override, seed_template_id")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (data?.model) setSessionModel(data.model as ModelId);
        if (data?.aspect_ratio) setAspectRatio(data.aspect_ratio as AspectRatio);
        if (data?.fps) setFps(data.fps);
        if (data?.duration_in_frames) setDurationInFrames(data.duration_in_frames);
        if (data?.duration_override) durationOverrideRef.current = true;
        if (data?.seed_template_id) setSeedTemplateId(data.seed_template_id);
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
      compileCode(latestCode, compileOptions.current);
      setHasGeneratedOnce(true);
      return;
    }

    // New session — read pending prompt/settings from sessionStorage + in-memory images
    const pendingPrompt = sessionStorage.getItem(PENDING_PROMPT_KEY);
    const pendingModel = sessionStorage.getItem(PENDING_MODEL_KEY) as ModelId | null;
    const pendingAspectRatio = sessionStorage.getItem(PENDING_ASPECT_RATIO_KEY) as AspectRatio | null;
    const storedImages = homePendingImages;
    clearPendingImages();
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
    sessionStorage.removeItem(PENDING_MODEL_KEY);
    sessionStorage.removeItem(PENDING_ASPECT_RATIO_KEY);

    if (pendingModel) {
      setSessionModel(pendingModel);
    }

    if (pendingAspectRatio) {
      setAspectRatio(pendingAspectRatio);
    }

    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      setTimeout(() => {
        chatSidebarRef.current?.triggerGeneration({ attachedImages: storedImages });
      }, 100);
    }
  }, [isLoaded, hasAutoStarted, latestCode, snapshots, initializeFromSnapshots, setCode, compileCode]);

  const handleModelChange = useCallback(
    (model: ModelId) => {
      setSessionModel(model);
      void supabase.from("sessions").update({ model }).eq("id", sessionId).then(() => undefined);
    },
    [sessionId],
  );

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
        compileCode(newCode, compileOptions.current);
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

  const handleManualSave = useCallback(async () => {
    const currentCode = codeRef.current;
    if (!currentCode) return;
    await saveSnapshot(currentCode, "Manual edit", "Manual edits saved", []);
    addAssistantMessage("Saved your manual edits.", currentCode, {
      skills: [],
      editType: "full_replacement",
    });
    markAsAiGenerated();
  }, [saveSnapshot, addAssistantMessage, markAsAiGenerated]);

  const handleUndo = useCallback(() => {
    const prevCode = undo();
    if (prevCode) {
      setCode(prevCode);
      compileCode(prevCode, compileOptions.current);
    }
  }, [undo, setCode, compileCode]);

  const handleRedo = useCallback(() => {
    const nextCode = redo();
    if (nextCode) {
      setCode(nextCode);
      compileCode(nextCode, compileOptions.current);
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
          onModelChange={handleModelChange}
          aspectRatio={aspectRatio}
          seedTemplateId={seedTemplateId}
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
                hasUnsavedEdits={hasManualEdits}
                onSave={handleManualSave}
              />
            }
            previewContent={
              <AnimationPlayer
                Component={generationError ? null : Component}
                durationInFrames={durationInFrames}
                fps={fps}
                onDurationChange={handleDurationChange}
                onFpsChange={handleFpsChange}
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

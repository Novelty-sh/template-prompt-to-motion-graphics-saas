"use client";

import { LandingPageInput } from "@/components/LandingPageInput";
import { PageLayout } from "@/components/PageLayout";
import { useSessions } from "@/hooks/useSessions";
import type { ModelId } from "@/types/generation";
import { ArrowRight, Video } from "lucide-react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PENDING_PROMPT_KEY = "session_pending_prompt";
const PENDING_MODEL_KEY = "session_pending_model";
const PENDING_ASPECT_RATIO_KEY = "session_pending_aspect_ratio";

// Images are too large for sessionStorage — keep in memory across client-side navigation
export let pendingImages: string[] | undefined;
export const clearPendingImages = () => { pendingImages = undefined; };

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const Home: NextPage = () => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const { sessions, isLoading, createSession } = useSessions();

  const handleNavigate = async (
    prompt: string,
    model: ModelId,
    attachedImages?: string[],
    aspectRatio?: string,
  ) => {
    setIsNavigating(true);

    // Create session in Supabase first
    const sessionId = await createSession(prompt, model, aspectRatio ?? "16:9");
    if (!sessionId) {
      setIsNavigating(false);
      return;
    }

    // Store initial prompt/images in sessionStorage for the video page to pick up
    sessionStorage.setItem(PENDING_PROMPT_KEY, prompt);
    sessionStorage.setItem(PENDING_MODEL_KEY, model);
    if (aspectRatio) sessionStorage.setItem(PENDING_ASPECT_RATIO_KEY, aspectRatio);
    pendingImages = attachedImages && attachedImages.length > 0 ? attachedImages : undefined;

    router.push(`/videos/${sessionId}`);
  };

  return (
    <PageLayout>
      <div className="flex flex-col items-center w-full flex-1 px-4 py-8 overflow-y-auto">
        <LandingPageInput
          onNavigate={handleNavigate}
          isNavigating={isNavigating}
          showCodeExamplesLink
        />

        {/* Previous sessions */}
        {!isLoading && sessions.length > 0 && (
          <div className="w-full max-w-3xl mt-10">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
              Recent Sessions
            </h2>
            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <Link key={session.id} href={`/videos/${session.id}`}>
                  <div className="flex items-center gap-3 p-3 bg-background-elevated rounded-lg border border-border hover:border-primary/40 transition-colors group">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Video className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {session.title || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDate(session.created_at)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Home;

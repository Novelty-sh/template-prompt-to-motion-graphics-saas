"use client";

import { LandingPageInput } from "@/components/LandingPageInput";
import { PageLayout } from "@/components/PageLayout";
import { useSessions } from "@/hooks/useSessions";
import { seedTemplates } from "@/seed-templates";
import type { ModelId } from "@/types/generation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Pencil, Trash2, Video } from "lucide-react";
import type { NextPage } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const { sessions, isLoading, createSession, createSessionFromTemplate, renameSession, deleteSession } = useSessions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const deleteTarget = sessions.find((s) => s.id === deleteTargetId);

  useEffect(() => {
    if (editingId) editInputRef.current?.select();
  }, [editingId]);

  const startEditing = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingValue(currentTitle || "");
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const id = editingId;
    const value = editingValue;
    setEditingId(null);
    const original = sessions.find((s) => s.id === id)?.title ?? "";
    if (value.trim() && value.trim() !== original) {
      await renameSession(id, value);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

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

  const handleTemplateClick = async (templateId: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    const sessionId = await createSessionFromTemplate(templateId);
    if (!sessionId) {
      setIsNavigating(false);
      return;
    }
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

        {/* Start from a template */}
        <div className="w-full max-w-3xl mt-10">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
            Or start from a template
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {seedTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateClick(template.id)}
                disabled={isNavigating}
                className="group flex flex-col items-stretch text-left bg-background-elevated rounded-lg border border-border hover:border-primary/40 transition-colors overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="relative w-full aspect-[9/16] bg-muted overflow-hidden">
                  <Image
                    src={template.thumbnail}
                    alt={template.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 200px"
                    className="object-cover group-hover:scale-[1.02] transition-transform"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground truncate">
                    {template.name}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {template.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Previous sessions */}
        {!isLoading && sessions.length > 0 && (
          <div className="w-full max-w-3xl mt-10">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
              Recent Sessions
            </h2>
            <div className="flex flex-col gap-2">
              {sessions.map((session) => {
                const isEditing = editingId === session.id;
                const rowInner = (
                  <div className="flex items-center gap-3 p-3 bg-background-elevated rounded-lg border border-border hover:border-primary/40 transition-colors group">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Video className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEdit();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          autoFocus
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <p className="text-sm text-foreground truncate">
                          {session.title || "Untitled"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDate(session.created_at)}
                      </p>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditing(session.id, session.title || "");
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        aria-label="Rename session"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTargetId(session.id);
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        aria-label="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isEditing && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    )}
                  </div>
                );
                return isEditing ? (
                  <div key={session.id}>{rowInner}</div>
                ) : (
                  <Link key={session.id} href={`/videos/${session.id}`}>
                    {rowInner}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <DialogContent className="sm:max-w-[425px] bg-background-elevated border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {deleteTarget?.title
                ? `"${deleteTarget.title}" will be hidden from your list. This can't be undone from the UI.`
                : "This session will be hidden from your list."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTargetId) return;
                const id = deleteTargetId;
                setDeleteTargetId(null);
                await deleteSession(id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Home;

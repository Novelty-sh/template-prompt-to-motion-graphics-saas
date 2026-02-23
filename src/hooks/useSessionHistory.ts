"use client";

import { type CodeSnapshot, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Session-based undo/redo history.
 * Receives sessionId from the URL — no localStorage dependency.
 */
export function useSessionHistory(sessionId: string) {
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);

  const snapshotsRef = useRef<CodeSnapshot[]>([]);
  const currentIndexRef = useRef(-1);

  useEffect(() => {
    snapshotsRef.current = snapshots;
  }, [snapshots]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!sessionId) {
      setIsLoaded(true);
      return;
    }
    setIsLoaded(false);
    loadSnapshots(sessionId);
  }, [sessionId]);

  const loadSnapshots = async (sid: string) => {
    const { data, error } = await supabase
      .from("code_snapshots")
      .select("*")
      .eq("session_id", sid)
      .order("sequence_number", { ascending: true });

    if (error || !data) {
      setIsLoaded(true);
      return;
    }

    setSnapshots(data);
    snapshotsRef.current = data;
    const lastIdx = data.length - 1;
    if (lastIdx >= 0) {
      setCurrentIndex(lastIdx);
      currentIndexRef.current = lastIdx;
    }
    setIsLoaded(true);
  };

  const saveSnapshot = useCallback(
    async (
      code: string,
      prompt: string,
      summary: string,
      skills: string[],
    ) => {
      const current = snapshotsRef.current;
      const idx = currentIndexRef.current;
      const activeSnapshots = current.slice(0, idx + 1);
      const sequenceNumber = activeSnapshots.length;

      const { data, error } = await supabase
        .from("code_snapshots")
        .insert({
          session_id: sessionId,
          code,
          prompt,
          summary,
          skills,
          sequence_number: sequenceNumber,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("Failed to save snapshot:", error);
        return;
      }

      // Delete any truncated redo snapshots from DB
      if (idx < current.length - 1) {
        const idsToDelete = current.slice(idx + 1).map((s) => s.id);
        await supabase.from("code_snapshots").delete().in("id", idsToDelete);
      }

      const newSnapshots = [...activeSnapshots, data];
      setSnapshots(newSnapshots);
      snapshotsRef.current = newSnapshots;
      const newIdx = newSnapshots.length - 1;
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
    },
    [sessionId],
  );

  const undo = useCallback((): string | null => {
    const idx = currentIndexRef.current;
    if (idx <= 0) return null;
    const newIdx = idx - 1;
    setCurrentIndex(newIdx);
    currentIndexRef.current = newIdx;
    return snapshotsRef.current[newIdx].code;
  }, []);

  const redo = useCallback((): string | null => {
    const idx = currentIndexRef.current;
    const snaps = snapshotsRef.current;
    if (idx >= snaps.length - 1) return null;
    const newIdx = idx + 1;
    setCurrentIndex(newIdx);
    currentIndexRef.current = newIdx;
    return snaps[newIdx].code;
  }, []);

  return {
    snapshots,
    currentIndex,
    isLoaded,
    latestCode: snapshots.length > 0 ? snapshots[snapshots.length - 1].code : null,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < snapshots.length - 1,
    saveSnapshot,
    undo,
    redo,
  };
}

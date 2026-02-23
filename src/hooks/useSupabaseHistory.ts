"use client";

import { type CodeSnapshot, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_KEY = "motion_graphics_session_id";

export function useSupabaseHistory() {
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // true once the localStorage check + optional Supabase load is complete
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialized = useRef(false);
  // Keep a ref to always have latest snapshots/index inside async callbacks
  const snapshotsRef = useRef<CodeSnapshot[]>([]);
  const currentIndexRef = useRef(-1);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    snapshotsRef.current = snapshots;
  }, [snapshots]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Load existing session from localStorage on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const storedSessionId = localStorage.getItem(SESSION_KEY);
    if (storedSessionId) {
      loadSnapshots(storedSessionId);
    } else {
      // No stored session — nothing to load, mark as ready immediately
      setIsLoaded(true);
    }
  }, []);

  const loadSnapshots = async (sid: string) => {
    const { data, error } = await supabase
      .from("code_snapshots")
      .select("*")
      .eq("session_id", sid)
      .order("sequence_number", { ascending: true });

    if (error || !data || data.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      setIsLoaded(true);
      return;
    }

    setSessionId(sid);
    sessionIdRef.current = sid;
    setSnapshots(data);
    snapshotsRef.current = data;
    const lastIdx = data.length - 1;
    setCurrentIndex(lastIdx);
    currentIndexRef.current = lastIdx;
    setIsLoaded(true);
  };

  const createSession = async (title: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ title })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Failed to create session:", error);
      return null;
    }

    localStorage.setItem(SESSION_KEY, data.id);
    setSessionId(data.id);
    sessionIdRef.current = data.id;
    return data.id;
  };

  const saveSnapshot = useCallback(
    async (
      code: string,
      prompt: string,
      summary: string,
      skills: string[],
    ) => {
      let sid = sessionIdRef.current;

      if (!sid) {
        sid = await createSession(prompt.slice(0, 100));
        if (!sid) return;
      }

      // Truncate any redo history beyond current index
      const current = snapshotsRef.current;
      const idx = currentIndexRef.current;
      const activeSnapshots = current.slice(0, idx + 1);
      const sequenceNumber = activeSnapshots.length;

      const { data, error } = await supabase
        .from("code_snapshots")
        .insert({
          session_id: sid,
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

      // Delete truncated future snapshots from DB
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
    [],
  );

  const undo = useCallback((): string | null => {
    const idx = currentIndexRef.current;
    const snaps = snapshotsRef.current;
    if (idx <= 0) return null;
    const newIdx = idx - 1;
    setCurrentIndex(newIdx);
    currentIndexRef.current = newIdx;
    return snaps[newIdx].code;
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

  const startNewSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    sessionIdRef.current = null;
    setSnapshots([]);
    snapshotsRef.current = [];
    setCurrentIndex(-1);
    currentIndexRef.current = -1;
  }, []);

  const latestCode =
    snapshots.length > 0 ? snapshots[snapshots.length - 1].code : null;

  return {
    snapshots,
    currentIndex,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < snapshots.length - 1,
    isLoaded,
    latestCode,
    saveSnapshot,
    undo,
    redo,
    startNewSession,
  };
}

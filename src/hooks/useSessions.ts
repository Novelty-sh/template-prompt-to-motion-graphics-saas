"use client";

import { getSeedTemplateById } from "@/seed-templates";
import { type Session, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    setSessions(data || []);
    setIsLoading(false);
  };

  const createSession = useCallback(
    async (title: string, model: string, aspectRatio: string = "16:9"): Promise<string | null> => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ title, model, aspect_ratio: aspectRatio })
        .select("id")
        .single();

      if (error || !data) {
        console.error("Failed to create session:", error);
        return null;
      }

      return data.id;
    },
    [],
  );

  const createSessionFromTemplate = useCallback(
    async (templateId: string): Promise<string | null> => {
      const template = getSeedTemplateById(templateId);
      if (!template) {
        console.error("Unknown seed template:", templateId);
        return null;
      }

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          title: template.name,
          model: template.defaultModel,
          aspect_ratio: template.aspectRatio,
          seed_template_id: template.id,
          fps: template.fps,
          duration_in_frames: template.durationInFrames,
        })
        .select("id")
        .single();

      if (sessionError || !session) {
        console.error("Failed to create session from template:", sessionError);
        return null;
      }

      const { error: snapshotError } = await supabase
        .from("code_snapshots")
        .insert({
          session_id: session.id,
          code: template.code,
          prompt: `Seeded from template: ${template.name}`,
          summary: "Initial template",
          skills: [],
          sequence_number: 0,
        });

      if (snapshotError) {
        console.error("Failed to seed initial snapshot:", snapshotError);
        await supabase.from("sessions").delete().eq("id", session.id);
        return null;
      }

      return session.id;
    },
    [],
  );

  const renameSession = useCallback(
    async (id: string, title: string): Promise<boolean> => {
      const trimmed = title.trim();
      if (!trimmed) return false;

      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)),
      );

      const { error } = await supabase
        .from("sessions")
        .update({ title: trimmed })
        .eq("id", id);

      if (error) {
        console.error("Failed to rename session:", error);
        loadSessions();
        return false;
      }
      return true;
    },
    [],
  );

  return { sessions, isLoading, createSession, createSessionFromTemplate, renameSession };
}

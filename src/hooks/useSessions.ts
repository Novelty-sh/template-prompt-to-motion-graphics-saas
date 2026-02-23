"use client";

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

  return { sessions, isLoading, createSession };
}

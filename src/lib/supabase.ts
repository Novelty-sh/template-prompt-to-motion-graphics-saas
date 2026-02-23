import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Session {
  id: string;
  created_at: string;
  title: string | null;
  model: string;
  aspect_ratio: string;
}

export interface CodeSnapshot {
  id: string;
  session_id: string;
  code: string;
  prompt: string | null;
  summary: string | null;
  skills: string[] | null;
  sequence_number: number;
  created_at: string;
}

export const ASPECT_RATIOS = [
  { id: "16:9", label: "16:9 Landscape", width: 1920, height: 1080 },
  { id: "9:16", label: "9:16 Portrait", width: 1080, height: 1920 },
  { id: "1:1", label: "1:1 Square", width: 1080, height: 1080 },
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number]["id"];

export const MODELS = [
  // OpenAI — GPT-5
  { id: "gpt-5.2:none", name: "GPT-5.2", group: "OpenAI" },
  { id: "gpt-5.2:low", name: "GPT-5.2 (Low)", group: "OpenAI" },
  { id: "gpt-5.2:medium", name: "GPT-5.2 (Medium)", group: "OpenAI" },
  { id: "gpt-5.2:high", name: "GPT-5.2 (High)", group: "OpenAI" },
  { id: "gpt-5.2-pro:medium", name: "GPT-5.2 Pro (Medium)", group: "OpenAI" },
  { id: "gpt-5.2-pro:high", name: "GPT-5.2 Pro (High)", group: "OpenAI" },
  { id: "gpt-5.2-pro:xhigh", name: "GPT-5.2 Pro (XHigh)", group: "OpenAI" },
  // Claude — via AWS Bedrock
  { id: "bedrock:claude-opus-4-6", name: "Claude Opus 4.6", group: "Claude" },
  { id: "bedrock:claude-sonnet-4-6", name: "Claude Sonnet 4.6", group: "Claude" },
  { id: "bedrock:claude-sonnet-4-5", name: "Claude Sonnet 4.5", group: "Claude" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export type StreamPhase = "idle" | "reasoning" | "generating";

export type GenerationErrorType = "validation" | "api";

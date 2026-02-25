import {
  getCombinedSkillContent,
  SKILL_DETECTION_PROMPT,
  SKILL_NAMES,
  type SkillName,
} from "@/skills";
import { ASPECT_RATIOS } from "@/types/generation";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, streamText } from "ai";
import { z } from "zod";

// Map friendly model IDs to actual AWS Bedrock model IDs.
const BEDROCK_MODEL_IDS: Record<string, string> = {
  "claude-opus-4-6": "us.anthropic.claude-opus-4-6-v1",
  "claude-sonnet-4-6": "us.anthropic.claude-sonnet-4-6",
  "claude-sonnet-4-5": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
};

const VALIDATION_PROMPT = `You are a prompt classifier for a motion graphics generation tool.

Determine if the user's prompt is asking for motion graphics/animation content that can be created as a React/Remotion component.

VALID prompts include requests for:
- Animated text, titles, or typography
- Data visualizations (charts, graphs, progress bars)
- UI animations (buttons, cards, transitions)
- Logo animations or brand intros
- Social media content (stories, reels, posts)
- Explainer animations
- Kinetic typography
- Abstract motion graphics
- Animated illustrations
- Product showcases
- Countdown timers
- Loading animations
- Any visual/animated content

INVALID prompts include:
- Questions (e.g., "What is 2+2?", "How do I...")
- Requests for text/written content (poems, essays, stories, code explanations)
- Conversations or chat
- Non-visual tasks (calculations, translations, summaries)
- Requests completely unrelated to visual content

Return true if the prompt is valid for motion graphics generation, false otherwise.`;

const SYSTEM_PROMPT = `
You are an expert in generating React components for Remotion animations.

## COMPONENT STRUCTURE

1. Start with ES6 imports
2. Export as: export const MyAnimation = () => { ... };
3. Component body order:
   - Multi-line comment description (2-3 sentences)
   - Hooks (useCurrentFrame, useVideoConfig, etc.)
   - Constants (COLORS, TEXT, TIMING, LAYOUT) - all UPPER_SNAKE_CASE
   - Calculations and derived values
   - return JSX

## CONSTANTS RULES (CRITICAL)

ALL constants MUST be defined INSIDE the component body, AFTER hooks:
- Colors: const COLOR_TEXT = "#000000";
- Text: const TITLE_TEXT = "Hello World";
- Timing: const FADE_DURATION = 20;
- Layout: const PADDING = 40;

This allows users to easily customize the animation.

## LAYOUT RULES

- Use full width of container with appropriate padding
- Never constrain content to a small centered box
- Use Math.max(minValue, Math.round(width * percentage)) for responsive sizing

## ANIMATION RULES

- Prefer spring() for organic motion (entrances, bounces, scaling)
- Use interpolate() for linear progress (progress bars, opacity fades)
- Always use { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
- Add stagger delays for multiple elements

## AVAILABLE IMPORTS

\`\`\`tsx
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Sequence } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Circle, Rect, Triangle, Star, Ellipse, Pie } from "@remotion/shapes";
import { ThreeCanvas } from "@remotion/three";
import { useState, useEffect } from "react";
\`\`\`

## RESERVED NAMES (CRITICAL)

NEVER use these as variable names - they shadow imports:
- spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence

## STYLING RULES

- Use inline styles only
- ALWAYS use fontFamily: 'Inter, sans-serif'
- Keep colors minimal (2-4 max)
- ALWAYS set backgroundColor on AbsoluteFill from frame 0 - never fade in backgrounds

## OUTPUT FORMAT (CRITICAL)

- Output ONLY code - no explanations, no questions
- Response must start with "import" and end with "};"
- If prompt is ambiguous, make a reasonable choice - do not ask for clarification
- NEVER reference a component that is not defined in the same file (e.g. <WebsiteScene>, <HeroSection>)
- ALL helper components MUST be defined as const functions ABOVE the main export in the same file
- The output must be entirely self-contained — one file, no missing definitions

`;

const FOLLOW_UP_SYSTEM_PROMPT = `
You are an expert at making targeted edits to React/Remotion animation components.

Given the current code and a user request, decide whether to:
1. Use targeted edits (for small, specific changes)
2. Provide full replacement code (for major restructuring)

## WHEN TO USE TARGETED EDITS (type: "edit")
- Changing colors, text, numbers, timing values
- Adding or removing a single element
- Modifying styles or properties
- Small additions (new variable, new element)
- Changes affecting <30% of the code

## WHEN TO USE FULL REPLACEMENT (type: "full")
- Completely different animation style
- Major structural reorganization
- User asks to "start fresh" or "rewrite"
- Changes affect >50% of the code

## EDIT FORMAT
For targeted edits, each edit needs:
- old_string: The EXACT string to find (including whitespace/indentation)
- new_string: The replacement string

CRITICAL:
- old_string must match the code EXACTLY character-for-character
- Include enough surrounding context to make old_string unique
- If multiple similar lines exist, include more surrounding code
- Preserve indentation exactly as it appears in the original

## PRESERVING USER EDITS
If the user has made manual edits, preserve them unless explicitly asked to change.
`;

// Prompt to classify whether an image-backed request should use image_base or react_reconstruct mode
const MODE_ROUTING_PROMPT = `You are classifying an animation request to determine the best approach for using a reference image.

Two modes:
- "image_base": Use the image as a static visual background and animate ON TOP of it without modifying image content.
  Choose this for: zoom in/out, pan, spotlight, ken burns, highlight a region, adding overlay elements on top (text labels, arrows, new messages appearing, counters, badges).
- "react_reconstruct": Recreate the full UI from the image as React/CSS code, giving full control over individual elements.
  Choose this for: changing button colors, resizing UI elements, modifying text content, animating each element independently, applying brand variations, changing layout.

Rule: if the request only needs visual camera-like effects or overlays on top of the image → "image_base". If it requires modifying or individually controlling existing UI elements → "react_reconstruct".`;

// System prompt addendum injected when mode = image_base
const IMAGE_BASE_SYSTEM_PROMPT = `## BASE FRAME MODE — Animating On Top of an Image

The user has provided a UI design image as the visual foundation. Animate ON TOP of it — do NOT recreate the UI from scratch.

### CRITICAL RULES
1. Add \`Img\` to your remotion import: \`import { ..., Img } from "remotion";\`
2. Declare the image src using this EXACT placeholder string (it will be replaced at runtime):
   \`const BASE_FRAME_SRC = "__BASE_FRAME__";\`
3. Render the base frame as the bottom layer, filling the entire composition:
\`\`\`tsx
<AbsoluteFill style={{ overflow: "hidden" }}>
  <div style={{ width: "100%", height: "100%", transform: \`...\` }}>
    <Img src={BASE_FRAME_SRC} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
</AbsoluteFill>
\`\`\`
4. Add animated overlay elements as siblings AFTER the base frame layer.
5. NEVER try to reconstruct the UI from the image. Use it as-is.

### ZOOM INTO A REGION
Apply scale + translate on a wrapper div around the Img. Use percentage translate to move the focal point to center.
Positive translateX shifts image right (shows left content); negative shifts left (shows right content).
\`\`\`tsx
const progress = spring({ frame, fps, config: { damping: 20, stiffness: 40 } });
const scale = interpolate(progress, [0, 1], [1, 2.5]);
const translateX = interpolate(progress, [0, 1], [0, -20]); // % — tune per region
const translateY = interpolate(progress, [0, 1], [0, 15]);  // % — tune per region
// wrapper div style:
// transform: \`scale(\${scale}) translate(\${translateX}%, \${translateY}%)\`, transformOrigin: "center center"
\`\`\`

### SPOTLIGHT / HIGHLIGHT A REGION
Use a semi-transparent dark overlay + bright border positioned at the target region using percentages.
\`\`\`tsx
const REGION = { top: "10%", left: "60%", width: "30%", height: "8%" };
// Dark overlay
<AbsoluteFill style={{ background: "rgba(0,0,0,0.55)", opacity: overlayOpacity }} />
// Highlight ring
<div style={{ position: "absolute", ...REGION, border: "3px solid #FFD700", borderRadius: 8, boxShadow: "0 0 24px #FFD700", opacity: ringOpacity }} />
\`\`\`

### KEN BURNS (slow zoom + subtle pan)
\`\`\`tsx
const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
const scale = interpolate(progress, [0, 1], [1, 1.12]);
const translateX = interpolate(progress, [0, 1], [0, -2]);
\`\`\`

### ADD OVERLAY ELEMENT (e.g. new message appearing on top)
Position new elements absolutely over approximate image coordinates using percentage-based values.
`;

// Schema for UI extraction from reference images
const UISpecSchema = z.object({
  uiType: z.string().describe("Type of UI: chat, dashboard, form, landing page, product card, etc."),
  colors: z.object({
    background: z.string().describe("Main background color as hex"),
    surface: z.string().nullable().describe("Card or surface color as hex, null if not present"),
    primary: z.string().nullable().describe("Primary brand/accent color as hex"),
    text: z.string().describe("Primary text color as hex"),
    textMuted: z.string().nullable().describe("Secondary/muted text color as hex"),
    sentBubble: z.string().nullable().describe("Sent message bubble color for chat UIs, null otherwise"),
    receivedBubble: z.string().nullable().describe("Received message bubble color for chat UIs, null otherwise"),
    topBar: z.string().nullable().describe("Top navigation bar color if present"),
    other: z.array(z.object({ name: z.string(), hex: z.string() })).describe("Any other notable colors"),
  }),
  typography: z.object({
    fontStyle: z.string().describe("Font style observed: rounded/geometric, serif, monospace, system-ui"),
    dominantWeight: z.string().describe("Dominant font weight: light, regular, medium, semibold, bold"),
    relativeSizes: z.string().describe("Description of text size hierarchy, e.g. 'large header, medium body, small meta'"),
  }),
  layout: z.object({
    borderRadiusStyle: z.string().describe("Border radius feel: sharp (0-2px), subtle (4-8px), rounded (12-18px), pill (999px)"),
    spacing: z.string().describe("Spacing density: compact, comfortable, spacious"),
    topBarPresent: z.boolean().describe("Whether a top navigation or header bar is visible"),
    structure: z.string().describe("Brief layout description, e.g. 'header + scrollable chat + input bar at bottom'"),
  }),
  textContent: z.array(z.string()).describe("ALL visible text in the image in reading order — exact strings, do not paraphrase"),
  replicationNotes: z.string().nullable().describe("Any other critical visual details needed to replicate this UI faithfully"),
});

const UI_EXTRACTION_PROMPT = `You are a pixel-accurate UI analyst. Your job is to extract exact visual properties from a UI screenshot so a developer can recreate it faithfully.

Rules:
- Sample colors as precisely as possible — provide exact hex values
- List ALL visible text exactly as it appears, word for word
- Do not guess or approximate brand colors — read them from the image
- Describe layout structure clearly so it can be rebuilt without seeing the image`;

function formatUISpec(spec: z.infer<typeof UISpecSchema>): string {
  const colorLines = [
    `  Background: ${spec.colors.background}`,
    spec.colors.topBar ? `  Top bar: ${spec.colors.topBar}` : null,
    spec.colors.surface ? `  Surface/card: ${spec.colors.surface}` : null,
    spec.colors.primary ? `  Primary/accent: ${spec.colors.primary}` : null,
    `  Text: ${spec.colors.text}`,
    spec.colors.textMuted ? `  Text muted: ${spec.colors.textMuted}` : null,
    spec.colors.sentBubble ? `  Sent bubble: ${spec.colors.sentBubble}` : null,
    spec.colors.receivedBubble ? `  Received bubble: ${spec.colors.receivedBubble}` : null,
    ...spec.colors.other.map((c) => `  ${c.name}: ${c.hex}`),
  ].filter(Boolean);

  return `## REFERENCE UI SPECIFICATION (extracted from uploaded image)
REPLICATE THIS UI EXACTLY. Use ONLY the values below — do not substitute with defaults or guesses.

UI Type: ${spec.uiType}

Colors (use these exact hex values as your constants):
${colorLines.join("\n")}

Typography:
  Style: ${spec.typography.fontStyle}
  Weight: ${spec.typography.dominantWeight}
  Sizes: ${spec.typography.relativeSizes}

Layout:
  Border radius: ${spec.layout.borderRadiusStyle}
  Spacing: ${spec.layout.spacing}
  Structure: ${spec.layout.structure}

Text content (copy EXACTLY — do not change wording):
${spec.textContent.map((t, i) => `  ${i + 1}. "${t}"`).join("\n")}
${spec.replicationNotes ? `\nAdditional notes: ${spec.replicationNotes}` : ""}`;
}

// Schema for follow-up edit responses
// Note: Using a flat object schema because OpenAI doesn't support discriminated unions
const FollowUpResponseSchema = z.object({
  type: z
    .enum(["edit", "full"])
    .describe(
      'Use "edit" for small targeted changes, "full" for major restructuring',
    ),
  summary: z
    .string()
    .describe(
      "A brief 1-sentence summary of what changes were made, e.g. 'Changed background color to blue and increased font size'",
    ),
  edits: z
    .array(
      z.object({
        description: z
          .string()
          .describe(
            "Brief description of this edit, e.g. 'Update background color', 'Increase animation duration'",
          ),
        old_string: z
          .string()
          .describe("The exact string to find (must match exactly)"),
        new_string: z.string().describe("The replacement string"),
      }),
    )
    .nullable()
    .describe(
      "Required when type is 'edit': array of search-replace operations. Null when type is 'full'.",
    ),
  code: z
    .string()
    .nullable()
    .describe(
      "Required when type is 'full': the complete replacement code starting with imports. Null when type is 'edit'.",
    ),
});

type EditOperation = {
  description: string;
  old_string: string;
  new_string: string;
  lineNumber?: number;
};

// Calculate line number where a string occurs in code
function getLineNumber(code: string, searchString: string): number {
  const index = code.indexOf(searchString);
  if (index === -1) return -1;
  return code.substring(0, index).split("\n").length;
}

// Apply edit operations to code and enrich with line numbers
function applyEdits(
  code: string,
  edits: EditOperation[],
): {
  success: boolean;
  result: string;
  error?: string;
  enrichedEdits?: EditOperation[];
  failedEdit?: EditOperation;
} {
  let result = code;
  const enrichedEdits: EditOperation[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const { old_string, new_string, description } = edit;

    // Check if the old_string exists
    if (!result.includes(old_string)) {
      return {
        success: false,
        result: code,
        error: `Edit ${i + 1} failed: Could not find the specified text`,
        failedEdit: edit,
      };
    }

    // Check for multiple matches (ambiguous)
    const matches = result.split(old_string).length - 1;
    if (matches > 1) {
      return {
        success: false,
        result: code,
        error: `Edit ${i + 1} failed: Found ${matches} matches. The edit target is ambiguous.`,
        failedEdit: edit,
      };
    }

    // Get line number before applying edit
    const lineNumber = getLineNumber(result, old_string);

    // Apply the edit
    result = result.replace(old_string, new_string);

    // Store enriched edit with line number
    enrichedEdits.push({
      description,
      old_string,
      new_string,
      lineNumber,
    });
  }

  return { success: true, result, enrichedEdits };
}

interface ConversationContextMessage {
  role: "user" | "assistant";
  content: string;
  /** For user messages, attached images as base64 data URLs */
  attachedImages?: string[];
}

interface ErrorCorrectionContext {
  error: string;
  attemptNumber: number;
  maxAttempts: number;
  failedEdit?: {
    description: string;
    old_string: string;
    new_string: string;
  };
}

interface GenerateRequest {
  prompt: string;
  model?: string;
  currentCode?: string;
  conversationHistory?: ConversationContextMessage[];
  isFollowUp?: boolean;
  hasManualEdits?: boolean;
  /** Error correction context for self-healing loops */
  errorCorrection?: ErrorCorrectionContext;
  /** Skills already used in this conversation (to avoid redundant skill content) */
  previouslyUsedSkills?: string[];
  /** Base64 image data URLs for visual context */
  frameImages?: string[];
  /** Target aspect ratio for the composition */
  aspectRatio?: string;
}

interface GenerateResponse {
  code: string;
  summary: string;
  metadata: {
    skills: string[];
    editType: "tool_edit" | "full_replacement";
    edits?: EditOperation[];
    model: string;
  };
}

export async function POST(req: Request) {
  const {
    prompt,
    model = "gpt-5.2",
    currentCode,
    conversationHistory = [],
    isFollowUp = false,
    hasManualEdits = false,
    errorCorrection,
    previouslyUsedSkills = [],
    frameImages,
    aspectRatio = "16:9",
  }: GenerateRequest = await req.json();

  const arConfig = ASPECT_RATIOS.find((ar) => ar.id === aspectRatio) ?? ASPECT_RATIOS[0];
  const aspectRatioGuidance = `
## COMPOSITION DIMENSIONS
The target aspect ratio is ${arConfig.id} (${arConfig.width}x${arConfig.height}).
- compositionWidth: ${arConfig.width}, compositionHeight: ${arConfig.height}
- Design ALL layouts for this aspect ratio
- For portrait (9:16): stack elements vertically, use full height, avoid wide horizontal layouts
- For landscape (16:9): use horizontal space, center content with side padding
- For square (1:1): balance content symmetrically
`;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          'The environment variable "OPENAI_API_KEY" is not set. Add it to your .env file and try again.',
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Detect provider from model ID prefix
  const isBedrock = model.startsWith("bedrock:");
  const modelKey = isBedrock ? model.slice("bedrock:".length) : model;

  // Parse model ID - format can be "model-name" or "model-name:reasoning_effort"
  const [modelName, reasoningEffort] = modelKey.split(":");

  const openai = createOpenAI({ apiKey });

  // Gemini via Vertex AI Express Mode — used for all vision tasks (image/video analysis)
  const GEMINI_VISION_MODEL = "gemini-3.1-pro-preview";
  const vertex = createVertex({ apiKey: process.env.GOOGLE_CLOUD_API_KEY });
  const geminiVision = vertex(GEMINI_VISION_MODEL);

  // Bedrock provider — authenticates via Bearer token (AWS_BEARER_TOKEN_BEDROCK env var)
  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION ?? "us-east-1",
    apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  });

  // Resolve the model instance to use for generation
  const bedrockModelId = BEDROCK_MODEL_IDS[modelName] ?? modelName;
  if (isBedrock) {
    console.log("Using Bedrock model ID:", bedrockModelId, "(verify in AWS Console → Bedrock → Model catalog)");
  }
  const generationModel = isBedrock
    ? bedrock(bedrockModelId)
    : openai(modelName);

  // Run validation, skill detection, mode routing, and UI extraction in parallel
  const hasReferenceImages = !isFollowUp && frameImages && frameImages.length > 0;

  const [validationResult, skillResult, modeRoutingResult, uiExtractionResult] = await Promise.allSettled([
    // Validate prompt (skip for follow-ups)
    isFollowUp
      ? Promise.resolve(null)
      : generateObject({
          model: openai("gpt-5.2"),
          system: VALIDATION_PROMPT,
          prompt: `User prompt: "${prompt}"`,
          schema: z.object({ valid: z.boolean() }),
        }).catch((e) => { console.error("Validation error:", e); return null; }),

    // Detect skills
    generateObject({
      model: openai("gpt-5.2"),
      system: SKILL_DETECTION_PROMPT,
      prompt: `User prompt: "${prompt}"`,
      schema: z.object({ skills: z.array(z.enum(SKILL_NAMES)) }),
    }).catch((e) => { console.error("Skill detection error:", e); return null; }),

    // Mode routing — classify image_base vs react_reconstruct when images are present
    hasReferenceImages
      ? generateObject({
          model: openai("gpt-5.2"),
          system: MODE_ROUTING_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "text" as const, text: `User request: "${prompt}"` },
              { type: "image" as const, image: frameImages![0] },
            ],
          }],
          schema: z.object({ mode: z.enum(["image_base", "react_reconstruct"]) }),
        }).catch((e) => { console.error("Mode routing error:", e); return null; })
      : Promise.resolve(null),

    // Extract UI spec from reference image — uses Gemini for superior vision accuracy
    // Result is only used when mode = react_reconstruct
    hasReferenceImages
      ? generateObject({
          model: geminiVision,
          system: UI_EXTRACTION_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "text" as const, text: "Extract the UI specification from this screenshot so I can animate it." },
              { type: "image" as const, image: frameImages![0] },
            ],
          }],
          schema: UISpecSchema,
        }).catch((e) => { console.error("UI extraction error:", e); return null; })
      : Promise.resolve(null),
  ]);

  // Handle validation result
  if (!isFollowUp && validationResult.status === "fulfilled" && validationResult.value) {
    const vResult = validationResult.value as { object: { valid: boolean } };
    if (!vResult.object.valid) {
      return new Response(
        JSON.stringify({
          error: "No valid motion graphics prompt. Please describe an animation or visual content you'd like to create.",
          type: "validation",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Handle skill detection result
  let detectedSkills: SkillName[] = [];
  if (skillResult.status === "fulfilled" && skillResult.value) {
    const sResult = skillResult.value as { object: { skills: SkillName[] } };
    detectedSkills = sResult.object.skills;
    console.log("Detected skills:", detectedSkills);
  }

  // Handle mode routing result
  let frameMode: "image_base" | "react_reconstruct" | null = null;
  if (modeRoutingResult.status === "fulfilled" && modeRoutingResult.value) {
    const mResult = modeRoutingResult.value as { object: { mode: "image_base" | "react_reconstruct" } };
    frameMode = mResult.object.mode;
    console.log("Frame mode:", frameMode);
  }

  // Build image-related system prompt section based on mode
  let uiSpecSection = "";
  if (frameMode === "image_base") {
    uiSpecSection = IMAGE_BASE_SYSTEM_PROMPT;
    console.log("Using image_base mode");
  } else if (uiExtractionResult.status === "fulfilled" && uiExtractionResult.value) {
    // react_reconstruct (or no images): inject extracted UI spec
    const eResult = uiExtractionResult.value as { object: z.infer<typeof UISpecSchema> };
    uiSpecSection = formatUISpec(eResult.object);
    console.log("UI spec extracted for:", eResult.object.uiType);
  }

  // Filter out skills that were already used in the conversation to avoid redundant context
  const newSkills = detectedSkills.filter(
    (skill) => !previouslyUsedSkills.includes(skill),
  );
  if (
    previouslyUsedSkills.length > 0 &&
    newSkills.length < detectedSkills.length
  ) {
    console.log(
      `Skipping ${detectedSkills.length - newSkills.length} previously used skills:`,
      detectedSkills.filter((s) => previouslyUsedSkills.includes(s)),
    );
  }

  // Load skill-specific content only for NEW skills (previously used skills are already in context)
  const skillContent = getCombinedSkillContent(newSkills as SkillName[]);
  const enhancedSystemPrompt = [
    SYSTEM_PROMPT,
    aspectRatioGuidance,
    uiSpecSection,
    skillContent ? `## SKILL-SPECIFIC GUIDANCE\n${skillContent}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // FOLLOW-UP MODE: Use non-streaming generateObject for faster edits
  if (isFollowUp && currentCode) {
    try {
      // Build context for the edit request
      const contextMessages = conversationHistory.slice(-6);
      let conversationContext = "";
      if (contextMessages.length > 0) {
        conversationContext =
          "\n\n## RECENT CONVERSATION:\n" +
          contextMessages
            .map((m) => {
              const imageNote =
                m.attachedImages && m.attachedImages.length > 0
                  ? ` [with ${m.attachedImages.length} attached image${m.attachedImages.length > 1 ? "s" : ""}]`
                  : "";
              return `${m.role.toUpperCase()}: ${m.content}${imageNote}`;
            })
            .join("\n");
      }

      const manualEditNotice = hasManualEdits
        ? "\n\nNOTE: The user has made manual edits to the code. Preserve these changes."
        : "";

      // Error correction context for self-healing
      let errorCorrectionNotice = "";
      if (errorCorrection) {
        const failedEditInfo = errorCorrection.failedEdit
          ? `

The previous edit attempt failed. Here's what was tried:
- Description: ${errorCorrection.failedEdit.description}
- Tried to find: \`${errorCorrection.failedEdit.old_string}\`
- Wanted to replace with: \`${errorCorrection.failedEdit.new_string}\`

The old_string was either not found or matched multiple locations. You MUST include more surrounding context to make the match unique.`
          : "";

        const isEditFailure =
          errorCorrection.error.includes("Edit") &&
          errorCorrection.error.includes("failed");

        if (isEditFailure) {
          errorCorrectionNotice = `

## EDIT FAILED (ATTEMPT ${errorCorrection.attemptNumber}/${errorCorrection.maxAttempts})
${errorCorrection.error}
${failedEditInfo}

CRITICAL: Your previous edit target was ambiguous or not found. To fix this:
1. Include MORE surrounding code context in old_string to make it unique
2. Make sure old_string matches the code EXACTLY (including whitespace)
3. If the code structure changed, look at the current code carefully`;
        } else {
          errorCorrectionNotice = `

## COMPILATION ERROR (ATTEMPT ${errorCorrection.attemptNumber}/${errorCorrection.maxAttempts})
The previous code failed to compile with this error:
\`\`\`
${errorCorrection.error}
\`\`\`

CRITICAL: Fix this compilation error. Common issues include:
- Syntax errors (missing brackets, semicolons)
- Invalid JSX (unclosed tags, invalid attributes)
- Undefined variables or imports
- TypeScript type errors

Focus ONLY on fixing the error. Do not make other changes.`;
        }
      }

      const editPromptText = `## CURRENT CODE:
\`\`\`tsx
${currentCode}
\`\`\`
${conversationContext}
${manualEditNotice}
${errorCorrectionNotice}

## USER REQUEST:
${prompt}
${frameImages && frameImages.length > 0 ? `\n(See the attached ${frameImages.length === 1 ? "image" : "images"} for visual reference)` : ""}

Analyze the request and decide: use targeted edits (type: "edit") for small changes, or full replacement (type: "full") for major restructuring.`;

      console.log(
        "Follow-up edit with prompt:",
        prompt,
        "model:",
        modelName,
        "skills:",
        detectedSkills.length > 0 ? detectedSkills.join(", ") : "general",
        frameImages && frameImages.length > 0
          ? `(with ${frameImages.length} image(s))`
          : "",
      );

      // Build messages array - include images if provided
      const editMessageContent: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
      > = [{ type: "text" as const, text: editPromptText }];
      if (frameImages && frameImages.length > 0) {
        for (const img of frameImages) {
          editMessageContent.push({ type: "image" as const, image: img });
        }
      }
      const editMessages: Array<{
        role: "user";
        content: Array<
          { type: "text"; text: string } | { type: "image"; image: string }
        >;
      }> = [
        {
          role: "user" as const,
          content: editMessageContent,
        },
      ];

      const editResult = await generateObject({
        model: generationModel,
        system: FOLLOW_UP_SYSTEM_PROMPT,
        messages: editMessages,
        schema: FollowUpResponseSchema,
      });

      const response = editResult.object;
      let finalCode: string;
      let editType: "tool_edit" | "full_replacement";
      let appliedEdits: EditOperation[] | undefined;

      if (response.type === "edit" && response.edits) {
        // Apply the edits to the current code
        const result = applyEdits(currentCode, response.edits);
        if (!result.success) {
          // If edits fail, return error with the failed edit details
          return new Response(
            JSON.stringify({
              error: result.error,
              type: "edit_failed",
              failedEdit: result.failedEdit,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        finalCode = result.result;
        editType = "tool_edit";
        // Use enriched edits with line numbers
        appliedEdits = result.enrichedEdits;
        console.log(`Applied ${response.edits.length} edit(s) successfully`);
      } else if (response.type === "full" && response.code) {
        // Full replacement
        finalCode = response.code;
        editType = "full_replacement";
        console.log("Using full code replacement");
      } else {
        // Invalid response - missing required fields
        return new Response(
          JSON.stringify({
            error: "Invalid AI response: missing required fields",
            type: "edit_failed",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Return the result with metadata
      const responseData: GenerateResponse = {
        code: finalCode,
        summary: response.summary,
        metadata: {
          skills: detectedSkills,
          editType,
          edits: appliedEdits,
          model: modelName,
        },
      };

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error in follow-up edit:", error);
      return new Response(
        JSON.stringify({
          error: "Something went wrong while processing the edit request.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // INITIAL GENERATION: Use streaming for new animations
  try {
    // Build messages for initial generation (supports image references)
    const hasImages = frameImages && frameImages.length > 0;
    const initialPromptText = hasImages
      ? `${prompt}\n\n(See the attached ${frameImages.length === 1 ? "image" : "images"} for visual reference)`
      : prompt;

    const initialMessageContent: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [{ type: "text" as const, text: initialPromptText }];
    if (hasImages) {
      for (const img of frameImages) {
        initialMessageContent.push({ type: "image" as const, image: img });
      }
    }

    const initialMessages: Array<{
      role: "user";
      content: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
      >;
    }> = [
      {
        role: "user" as const,
        content: initialMessageContent,
      },
    ];

    const result = streamText({
      model: generationModel,
      system: enhancedSystemPrompt,
      messages: initialMessages,
      ...(reasoningEffort && !isBedrock && {
        providerOptions: {
          openai: {
            reasoningEffort: reasoningEffort,
          },
        },
      }),
    });

    console.log(
      "Generating React component with prompt:",
      prompt,
      "model:",
      modelName,
      "skills:",
      detectedSkills.length > 0 ? detectedSkills.join(", ") : "general",
      reasoningEffort ? `reasoning_effort: ${reasoningEffort}` : "",
      hasImages ? `(with ${frameImages.length} image(s))` : "",
    );

    // Get the original stream response
    const originalResponse = result.toUIMessageStreamResponse({
      sendReasoning: true,
    });

    // Create metadata event to prepend
    const metadataEvent = `data: ${JSON.stringify({
      type: "metadata",
      skills: detectedSkills,
      frameMode,
    })}\n\n`;

    // Create a new stream that prepends metadata before the LLM stream
    const originalBody = originalResponse.body;
    if (!originalBody) {
      return originalResponse;
    }

    const reader = originalBody.getReader();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send metadata event first
        controller.enqueue(encoder.encode(metadataEvent));

        // Then pipe through the original stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: originalResponse.headers,
    });
  } catch (error) {
    console.error("Error generating code:", error);
    return new Response(
      JSON.stringify({
        error: "Something went wrong while trying to reach OpenAI APIs.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-powered motion graphics generator that transforms natural language prompts into Remotion video components. Users describe an animation, Claude generates a React/Remotion component using Agent Skills for Remotion knowledge, compiles it in-browser with Babel, and renders it live in a Remotion Player. Multi-turn conversation allows iterative refinement.

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm run remotion     # Remotion Studio (local composition preview)
npm run render       # Remotion CLI render
npm run deploy       # Deploy Remotion Lambda site (node deploy.mjs)
```

### Skill Management

```bash
npx tsx scripts/upload-remotion-skill.ts   # Download & upload Remotion skills → get ANTHROPIC_REMOTION_SKILL_ID
npx tsx scripts/upload-skill.ts <folder>   # Upload any custom skill (client/domain) → get skill_id
```

## Architecture

### Generation Pipeline

```
User Prompt → Validation (OpenAI generateObject classifier)
            → Skill Detection (OpenAI generateObject → local skill files)
            → Image Mode Routing (if images: image_base vs react_reconstruct)
            → UI Extraction via Gemini vision (if images attached)
            → Code Generation (streaming via Vercel AI SDK streamText)
            → Babel Compilation (in-browser, @babel/standalone)
            → Live Preview (Remotion Player with injected APIs)
```

**Follow-up edits** have two paths based on the model provider:
- **Claude (Bedrock models)**: Uses Anthropic's native text editor tool (`str_replace_based_edit_tool`) via direct Anthropic API. Multi-turn tool-use loop where Claude views code, applies `str_replace` edits, and gets feedback. Claude is fine-tuned for exact string matching with this tool.
- **OpenAI models**: Uses `generateObject` with structured output (Zod schema) to produce edit or full-replacement responses.

An auto-correction loop (max 3 attempts) re-prompts on compilation errors.

### Key Code Paths

- **API route** (`src/app/api/generate/route.ts`): Orchestrates validation, skill detection, image analysis, and code generation. Initial generation uses Vercel AI SDK `streamText`; follow-up edits branch by provider (Claude → text editor tool, OpenAI → structured output).
- **Text editor** (`src/lib/anthropic-editor.ts`): Wraps Claude's native `str_replace_based_edit_tool` in a multi-turn loop. Handles `view`, `str_replace`, `create`, `insert` commands against in-memory code via direct Anthropic API.
- **Local skills** (`src/skills/index.ts`): Reads markdown skill files and example code, combines them into system prompt text. A classifier detects relevant skills per prompt.
- **Compiler** (`src/remotion/compiler.ts`): Strips imports, extracts component body, transpiles with Babel, executes via `new Function()` with all Remotion APIs injected as arguments. Also strips top-level `export` keywords (so templates with multiple exports like `calculateMetadata` don't break when wrapped in a function body) and picks the **last** zero-arg arrow as the main component — so helper arrow fns with empty params must appear above the main one.
- **Session model**: Each session (`/videos/[sessionId]`) stores a linear history of code snapshots in Supabase with undo/redo via `sequence_number`. Manual edits do **not** auto-snapshot — the editor header has a Save button (active when `hasManualEdits`) that pushes a snapshot and posts a "Saved your manual edits." turn to the sidebar.

#### Unused / staged code (not wired into route)
- `src/lib/anthropic.ts`: Anthropic client with Agent Skills beta headers. Prepared for future Agent Skills integration.
- `src/lib/anthropic-stream-adapter.ts`: Translates Anthropic SDK stream events into SSE. Built for Agent Skills streaming, not currently used.
- `src/lib/anthropic-structured.ts`: `generateStructured()` helper using Anthropic tool_use. Not currently used.

### Skills System (Local)

Skills are local markdown files in `src/skills/` and example code in `src/examples/code`. A classifier (`generateObject` with OpenAI) detects which skills are relevant to the user's prompt, then `getCombinedSkillContent()` concatenates their text into the system prompt.

**Guidance skills** (patterns/rules): `charts`, `typography`, `social-media`, `messaging`, `3d`, `transitions`, `sequencing`, `spring-physics`
**Example skills** (complete code references): `example-histogram`, `example-progress-bar`, `example-text-rotation`, etc.

**Adding skills**: Add a `.md` file to `src/skills/`, import it in `src/skills/index.ts`, add to `GUIDANCE_SKILLS` and `guidanceSkillContent`, and add detection keywords to `SKILL_DETECTION_PROMPT`.

### Compilation & Runtime Injection

Generated code is compiled client-side. The compiler injects these APIs as function arguments (no real imports at runtime):
- **Remotion core**: `AbsoluteFill`, `Sequence`, `Img`, `useCurrentFrame`, `useVideoConfig`, `spring`, `interpolate`, `Easing`
- **Shapes**: `Rect`, `Circle`, `Triangle`, `Star`, `Polygon`, `Ellipse`, `Heart`, `Pie` (plus `make*` path variants)
- **Transitions**: `TransitionSeries`, `linearTiming`, `springTiming`, `fade`, `slide`, `wipe`, `flip`, `clockWipe`
- **3D**: `ThreeCanvas`, `THREE`
- **Emoji**: `Emoji`, `getEmojiUrl`, `renderTextWithEmoji` (Twemoji — consistent cross-platform emoji rendering via CDN SVGs)
- **Other**: `Lottie`, `React`, `useState`, `useEffect`, `useMemo`, `useRef`
- **Duration auto-follow**: `__setDuration(frames)` — compiler-injected hook. Generated code calls it with its natural length (e.g. `__setDuration(totalFrames + 5 * fps)`). Internally defers via `useEffect` and fires `CompileOptions.onReportDuration`, which the session page wires to persist `duration_in_frames` to Supabase. Skipped when `sessions.duration_override = true` so the user's Settings-modal choice survives re-renders. `calculateMetadata`-style exports do **not** work — our in-browser pipeline never runs Remotion's composition-setup hooks.

When adding new APIs to generated code, they must be added in three places: the compiler's `new Function()` parameter list, the corresponding argument in the call, and the system prompt guidance.

### Data Model (Supabase)

Two tables. Anonymous access, no auth required. Migrations in `supabase/migrations/`.

- **sessions**: `id, created_at, title, model, aspect_ratio, fps, duration_in_frames, seed_template_id, duration_override, deleted`
  - `duration_override`: set true when the user edits duration in the Settings modal; blocks `__setDuration` from overwriting.
  - `deleted`: soft-delete flag; home page filters `deleted=false`.
  - `seed_template_id`: links a session to the seed template it was created from (drives sticky template-mode on follow-ups).
- **code_snapshots**: `id, session_id, code, prompt, summary, skills[], sequence_number, created_at`

### Seed Templates

Sessions can be started from a pre-built template (WhatsApp light/dark etc.) so the user lands on a working animation and only chats to tweak. Registry at `src/seed-templates/index.ts`; template code strings live next to it (e.g. `whatsapp-chat-dark-code.ts`).

- **Wrap the code in `` String.raw`...` ``**, not a plain backtick. `String.raw` keeps `\"`, `\s`, `\u{...}` literal so you can paste real `.tsx` into the file without escape juggling. Only `` ` `` and `${` still need escaping.
- Every `SeedTemplate` declares a matching `skill` (e.g. `template-whatsapp-chat-light`). The route merges this into `activeSkills` whenever `seedTemplateId` is set — keeps template mode sticky across follow-ups even when the classifier wouldn't re-detect it from a prompt like "use this as profile pic".
- Inside the template's component, call `__setDuration(totalFrames + 5 * fps)` so the Player auto-follows the animation length.
- Top-level declarations can be any mix of exports / consts / types — the compiler strips `export` before wrapping. The main component must be a zero-arg arrow (`export const WhatsApp = () => {...};`) placed **last**, because the compiler picks the last zero-arg arrow it finds.

### AI Providers

- **OpenAI** (via Vercel AI SDK `@ai-sdk/openai`): Used for initial generation streaming, utility calls (validation, skill detection, mode routing), and OpenAI follow-up edits.
- **AWS Bedrock** (via Vercel AI SDK `@ai-sdk/amazon-bedrock`): Claude Sonnet 4.6 / Opus 4.6 for initial generation streaming. Model prefix `bedrock:` in request triggers this path.
- **Anthropic direct** (via `@anthropic-ai/sdk`): Used only for follow-up edits with Claude's text editor tool (`str_replace_based_edit_tool`). Bypasses Bedrock for this path because the text editor tool is Anthropic API-only.
- **Google Vertex** (via Vercel AI SDK `@ai-sdk/google-vertex`): Gemini 3.1 Pro — used only for vision (image analysis / UI extraction).

Model IDs sent from frontend: `gpt-5.4`, `bedrock:claude-sonnet-4-6`, `bedrock:claude-opus-4-6`. Bedrock prefix is stripped before passing to Anthropic direct API for edits.

### Streaming Protocol

Initial generation uses Vercel AI SDK's `toUIMessageStreamResponse()` with a prepended metadata SSE event:
- First event: metadata (`skills`, `frameMode`) — injected before the SDK stream
- Remaining events: Vercel AI SDK's standard UI message stream format
- Reasoning events forwarded when `sendReasoning: true`

Follow-up edits are non-streaming (single JSON response).

### Lambda Rendering

Video rendering happens via an external Remotion backend (`REMOTION_BACKEND_URL`). Endpoints at `src/app/api/lambda/render/` (trigger) and `src/app/api/lambda/progress/` (poll). Config in `config.mjs`.

**Lambda site (`novelty-saas`)** is a separately bundled and deployed Remotion site on AWS S3 (`remotionlambda-apsouth1-fuz4jru0l4`, region `ap-south-1`). It is NOT part of the Next.js/Vercel deployment — it has its own webpack bundle via `deploy.mjs`.

**CRITICAL: After changing any code that runs inside Remotion compositions, you MUST redeploy the Lambda site:**
```bash
npm run deploy   # Bundles current code and uploads to S3 as novelty-saas
```

This applies to changes in:
- `src/remotion/compiler.ts` (injected APIs, compilation logic)
- `src/remotion/DynamicComp.tsx` (composition wrapper)
- Any module imported by the above (e.g. `src/lib/twemoji.ts`)
- `config.mjs` (Lambda config)

**Import rule for `src/remotion/` files**: The Lambda bundler uses its own webpack config (not Next.js), so `@/` path aliases do NOT resolve. Always use **relative imports** (e.g. `../lib/twemoji`) in files under `src/remotion/`. Preview (Next.js dev server) resolves `@/` fine, but Lambda rendering will fail without relative paths.

## Gotchas

- **supabase-js v2 builders are thenables — you must `await` or `.then()` them.** `supabase.from("x").update(...).eq(...)` without a subscriber silently drops the request. Fire-and-forget works only if you explicitly subscribe (e.g. `void supabase...then(() => undefined)`). This bit the settings-persist path once already.
- **`scripts/**` is excluded from tsconfig** because `scripts/upload-wallpapers.ts` uses Node `Buffer` as a fetch body, which newer `@types/node` no longer accepts as `BodyInit`. Those scripts are local dev tools, not bundled into the Next.js app — no reason for `next build` to type-check them. Keep new one-off scripts in `scripts/` too.
- **Dev server caches `src/remotion/compiler.ts`** — if you change injected APIs and the preview shows "X is not defined", kill the dev server and `rm -rf .next` before restarting.

## Environment Variables

```
OPENAI_API_KEY                 # OpenAI API key (initial gen, utility calls, OpenAI edits)
ANTHROPIC_API_KEY              # Anthropic API key (Claude text editor tool for follow-up edits)
AWS_BEARER_TOKEN_BEDROCK       # Bedrock auth for Claude initial generation
AWS_REGION                     # Bedrock region (default: us-east-1)
GOOGLE_CLOUD_API_KEY           # Vertex AI / Gemini (vision)
GCS_SERVICE_ACCOUNT_KEY_PATH   # Path to GCS service account JSON key (for image uploads to novelty-public-videos bucket)
REMOTION_AWS_ACCESS_KEY_ID     # Lambda rendering credentials
REMOTION_AWS_SECRET_ACCESS_KEY
REMOTION_BACKEND_URL           # External Remotion render service
NEXT_PUBLIC_SUPABASE_URL       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

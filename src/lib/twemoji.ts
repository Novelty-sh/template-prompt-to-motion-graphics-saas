/**
 * Twemoji utilities — convert emoji characters to Twemoji CDN image URLs
 * and render them as inline <img> elements for consistent cross-platform display.
 *
 * Uses the jdecked/twemoji CDN (community fork, actively maintained).
 * SVG format for crisp rendering at any size.
 */

import React from "react";

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

/**
 * Convert an emoji character (or multi-codepoint sequence) to its Twemoji SVG URL.
 *
 * Handles:
 * - Simple emoji: "😀" → "1f600.svg"
 * - ZWJ sequences: "👨‍💻" → "1f468-200d-1f4bb.svg"
 * - Skin tone modifiers: "👋🏽" → "1f44b-1f3fd.svg"
 * - Flag sequences: "🇺🇸" → "1f1fa-1f1f8.svg"
 * - Keycap sequences: strips variant selector U+FE0F
 */
export function getEmojiUrl(emoji: string): string {
  const codepoints = [];
  for (let i = 0; i < emoji.length; i++) {
    const code = emoji.codePointAt(i)!;
    // Skip variant selector VS16 (U+FE0F) — Twemoji filenames omit it
    if (code === 0xfe0f) continue;
    codepoints.push(code.toString(16));
    // Skip low surrogate for astral codepoints
    if (code > 0xffff) i++;
  }
  return `${TWEMOJI_BASE}/${codepoints.join("-")}.svg`;
}

interface EmojiProps {
  /** The emoji character(s) to render, e.g. "😀" or "👨‍💻" */
  emoji: string;
  /** Size in pixels (width and height). Defaults to 20. */
  size?: number;
  /** Optional inline style overrides */
  style?: React.CSSProperties;
}

/**
 * Renders an emoji as a Twemoji SVG image.
 * Drop-in replacement for raw emoji text — renders identically on all platforms.
 *
 * Usage in generated code:
 *   <Emoji emoji="🔥" size={24} />
 *   <Emoji emoji="👋🏽" />
 */
export const Emoji: React.FC<EmojiProps> = ({ emoji, size = 20, style }) => {
  return React.createElement("img", {
    src: getEmojiUrl(emoji),
    alt: emoji,
    width: size,
    height: size,
    draggable: false,
    style: {
      display: "inline-block",
      verticalAlign: "middle",
      ...style,
    },
  });
};

// ---------------------------------------------------------------------------
// Inline text + emoji renderer
// ---------------------------------------------------------------------------

// Matches emoji sequences: basic, skin-toned, ZWJ (family/profession), flags, keycaps.
// Uses Unicode Extended_Pictographic which covers all standard emoji.
// Built via RegExp constructor to avoid TS es5 target error with the /u flag.
const EMOJI_RE = new RegExp(
  "(\\p{Extended_Pictographic}(?:\\uFE0F)?(?:\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F)?(?:\\p{Emoji_Modifier})?)*)",
  "gu",
);

/**
 * Parse a text string and replace emoji characters with <Emoji> components.
 * Returns an array of React nodes (strings + Emoji elements) that can be
 * rendered as children of a <span>.
 *
 * Usage:
 *   <span>{renderTextWithEmoji("Hello 👋🏽 world! 🔥", 18)}</span>
 */
export function renderTextWithEmoji(
  text: string,
  emojiSize?: number,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Reset regex state
  EMOJI_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EMOJI_RE.exec(text)) !== null) {
    // Text before this emoji
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Emoji image
    parts.push(
      React.createElement(Emoji, {
        key: `e${match.index}`,
        emoji: match[0],
        size: emojiSize,
      }),
    );
    lastIndex = EMOJI_RE.lastIndex;
  }

  // Remaining text after last emoji
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

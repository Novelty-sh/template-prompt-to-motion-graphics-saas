export const whatsappChatDarkSeedCode = `import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, Easing } from "remotion";
import { renderTextWithEmoji } from "@/lib/twemoji";

type PopConfig = {
  delay?: number;
  scale?: number;
  growFrames?: number;
  holdFrames?: number;
  shrinkFrames?: number;
};

type Message = {
  text: string;
  sent: boolean;
  time: string;
  pop?: PopConfig;
};

const POP_DEFAULTS = { delay: 15, scale: 1.4, growFrames: 8, holdFrames: 30, shrinkFrames: 8 };

const getPopTotalDuration = (pop?: PopConfig) => {
  if (!pop) return 0;
  return (pop.delay ?? POP_DEFAULTS.delay)
    + (pop.growFrames ?? POP_DEFAULTS.growFrames)
    + (pop.holdFrames ?? POP_DEFAULTS.holdFrames)
    + (pop.shrinkFrames ?? POP_DEFAULTS.shrinkFrames);
};

export const MyAnimation = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ===== DYNAMIC DATA (Replace this section based on user prompt) =====
  const CONTACT_NAME = "Jhumki";
  const CONTACT_AVATAR_URL = "";
  const MESSAGES: Message[] = [
    { text: "I tracked the IP. The thief isn't a stranger.", sent: false, time: "11:42 PM" },
    { text: "Who is it??", sent: true, time: "11:42 PM", pop: { scale: 2 } },
    { text: "The signal is coming from your kitchen. \u{1F4CD}", sent: false, time: "11:43 PM" },
    { text: "I'm the only one here", sent: true, time: "11:43 PM", pop: { scale: 2 } },
    { text: "Look at the 0:12 mark. The reflection in the toaster.", sent: false, time: "11:44 PM" },
    { text: "Wait. Is that my MOM?? In her bathrobe?? \u{1F475}", sent: true, time: "11:44 PM", pop: {} },
    { text: "She's doing the Dubai transition. With a rolling pin.", sent: false, time: "11:45 PM" },
    { text: "She told me she was taking a NAP \u{1F62D}", sent: true, time: "11:45 PM" },
    { text: "She's replying to comments saying \\"Thanks fam, check my link in bio for pickle recipes.\\"", sent: false, time: "11:46 PM" },
    { text: "Jhumki she has more followers than us combined.", sent: true, time: "11:46 PM" },
    { text: "I'm outside your door. I can hear her practicing the next script.", sent: false, time: "11:47 PM" },
  ];
  // ===== END DYNAMIC DATA =====

  // ===== TEMPLATE CONSTANTS (WhatsApp dark theme) =====
  const WALLPAPER_URL = "https://videos.novelty.sh/motion-graphics/wallpapers/whatsapp-dark.jpg";
  const COLOR_BG = "#0b141a";
  const COLOR_HEADER = "#121212";
  const COLOR_SENT_BUBBLE = "#005c4b";
  const COLOR_RECEIVED_BUBBLE = "#202c33";
  const COLOR_TEXT = "#e9edef";
  const COLOR_TIME = "#ffffff99";
  const COLOR_INPUT_BG = "#2a3942";
  const COLOR_FOOTER_BG = "#121212";
  const COLOR_ICON = "#8696a0";
  const COLOR_GREEN = "#00a884";
  const FONT = "Inter, system-ui, -apple-system, sans-serif";
  const HEADER_HEIGHT = Math.round(height * 0.08);
  const INPUT_HEIGHT = Math.round(height * 0.07);
  const BUBBLE_MAX_WIDTH = "75%";
  const BUBBLE_RADIUS = 24;
  const TAIL_SIZE = 16;
  const TYPING_DOTS_BASE = 20;
  const TYPING_DOTS_PER_CHAR = 1.2;
  const TYPING_CHAR_SPEED = 3.5;
  const TYPING_DURATION_CAP = 9999;
  const POST_MESSAGE_GAP = 6;
  // ===== END TEMPLATE CONSTANTS =====

  const scale = Math.min(width / 1080, height / 1920);
  const fontSize = Math.round(36 * scale);
  const smallFontSize = Math.round(27 * scale);
  const padding = Math.round(16 * scale);
  const bubbleRadius = Math.round(BUBBLE_RADIUS * scale);
  const tailSize = Math.round(TAIL_SIZE * scale);

  const initials = CONTACT_NAME.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // ===== CHAT TIMELINE =====
  const getTypingDurForSent = (text: string, seed: number) => {
    const chars = Array.from(text);
    let acc = 0;
    for (let c = 0; c < chars.length; c++) {
      const hash = Math.sin((c + 1) * 9301 + seed * 7919) * 10000;
      const variation = (hash - Math.floor(hash));
      const isAfterPause = c > 0 && /[.,!?\\s]/.test(chars[c - 1]);
      const baseDelay = TYPING_CHAR_SPEED * (0.6 + variation * 0.8);
      const pauseExtra = isAfterPause ? TYPING_CHAR_SPEED * (0.4 + variation * 0.6) : 0;
      acc += baseDelay + pauseExtra;
    }
    return Math.min(Math.ceil(acc) + 6, TYPING_DURATION_CAP);
  };
  const getReceivedTypingDur = (text: string) => {
    const charCount = Array.from(text).length;
    return Math.round(TYPING_DOTS_BASE + charCount * TYPING_DOTS_PER_CHAR);
  };
  const getTypingDur = (m: { text: string; sent: boolean }, idx: number) => m.sent
    ? getTypingDurForSent(m.text, idx)
    : getReceivedTypingDur(m.text);
  const messageStartFrames: number[] = [];
  {
    let acc = 0;
    for (let i = 0; i < MESSAGES.length; i++) {
      acc += getTypingDur(MESSAGES[i], i) + POST_MESSAGE_GAP;
      messageStartFrames.push(acc);
      acc += getPopTotalDuration(MESSAGES[i].pop);
    }
  }

  // Build per-character frame thresholds with natural variation
  const getCharFrames = (text: string, seed: number) => {
    const chars = Array.from(text);
    const thresholds: number[] = [];
    let acc = 0;
    for (let c = 0; c < chars.length; c++) {
      const hash = Math.sin((c + 1) * 9301 + seed * 7919) * 10000;
      const variation = (hash - Math.floor(hash));
      const isAfterPause = c > 0 && /[.,!?\\s]/.test(chars[c - 1]);
      const baseDelay = TYPING_CHAR_SPEED * (0.6 + variation * 0.8);
      const pauseExtra = isAfterPause ? TYPING_CHAR_SPEED * (0.4 + variation * 0.6) : 0;
      acc += baseDelay + pauseExtra;
      thresholds.push(acc);
    }
    return thresholds;
  };

  let typingText: string | null = null;
  for (let i = 0; i < MESSAGES.length; i++) {
    const m = MESSAGES[i];
    if (!m.sent) continue;
    const msgStart = messageStartFrames[i];
    const typingDur = getTypingDur(m, i);
    const typingStart = msgStart - typingDur;
    if (frame >= typingStart && frame < msgStart) {
      const chars = Array.from(m.text);
      const charFrames = getCharFrames(m.text, i);
      const elapsed = frame - typingStart;
      let charCount = 0;
      for (let c = 0; c < charFrames.length; c++) {
        if (elapsed >= charFrames[c]) charCount = c + 1;
        else break;
      }
      typingText = chars.slice(0, charCount).join("");
      break;
    }
  }

  const TypingIndicator = ({ startFrame }: { startFrame: number }) => {
    const localFrame = frame - startFrame;
    if (localFrame < 0) return null;
    const opacity = interpolate(localFrame, [0, 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const dots = [0, 1, 2].map((idx) => {
      const bounce = Math.sin(((localFrame * 0.3) + idx * 1.2) % (Math.PI * 2));
      return interpolate(bounce, [-1, 1], [2, -4]);
    });
    const bubblePad = String(Math.round(10 * scale)) + "px " + String(Math.round(14 * scale)) + "px";
    return (
      <div style={{
        display: "flex",
        justifyContent: "flex-start",
        paddingLeft: padding,
        paddingRight: padding,
        marginBottom: Math.round(6 * scale),
        opacity,
      }}>
        <div style={{
          backgroundColor: COLOR_RECEIVED_BUBBLE,
          borderRadius: BUBBLE_RADIUS,
          padding: bubblePad,
          display: "flex",
          gap: Math.round(4 * scale),
          alignItems: "center",
        }}>
          {dots.map((dotY, idx) => (
            <div
              key={idx}
              style={{
                width: Math.round(8 * scale),
                height: Math.round(8 * scale),
                borderRadius: "50%",
                backgroundColor: COLOR_ICON,
                transform: "translateY(" + dotY + "px)",
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR_BG, fontFamily: FONT, overflow: "hidden" }}>
      <Img src={WALLPAPER_URL} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: HEADER_HEIGHT,
        backgroundColor: COLOR_HEADER, display: "flex", alignItems: "center",
        padding: "0 " + padding + "px", gap: Math.round(12 * scale), zIndex: 10,
      }}>
        <svg width={Math.round(24 * scale)} height={Math.round(24 * scale)} viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke={COLOR_TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div style={{
          width: Math.round(40 * scale), height: Math.round(40 * scale), borderRadius: "50%",
          backgroundColor: COLOR_GREEN, display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          {CONTACT_AVATAR_URL ? (
            <Img src={CONTACT_AVATAR_URL} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "#fff", fontSize: Math.round(24 * scale), fontWeight: 600 }}>{initials}</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: COLOR_TEXT, fontSize: Math.round(26 * scale), fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{CONTACT_NAME}</div>
          <div style={{ color: COLOR_TIME, fontSize: smallFontSize }}>online</div>
        </div>

        <div style={{ display: "flex", gap: Math.round(20 * scale) }}>
          <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill="none">
            <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5" r="1.5" fill={COLOR_ICON} />
            <circle cx="12" cy="12" r="1.5" fill={COLOR_ICON} />
            <circle cx="12" cy="19" r="1.5" fill={COLOR_ICON} />
          </svg>
        </div>
      </div>

      {/* Chat area */}
      <div style={{
        position: "absolute", top: HEADER_HEIGHT, left: 0, right: 0, bottom: INPUT_HEIGHT,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        padding: padding + "px " + padding + "px " + Math.round(8 * scale) + "px",
        overflow: "hidden",
      }}>
        {MESSAGES.map((msg, i) => {
          const msgStartFrame = messageStartFrames[i];
          const isReceived = !msg.sent;

          const receivedTypingDur = isReceived ? getReceivedTypingDur(msg.text) : 0;
          const sentTypingDur = msg.sent ? getTypingDurForSent(msg.text, i) : 0;
          const typingStartFrame = isReceived
            ? msgStartFrame - receivedTypingDur
            : msgStartFrame - sentTypingDur;
          const showTyping = isReceived && frame >= typingStartFrame && frame < msgStartFrame;

          const isVisible = frame >= typingStartFrame;
          if (!isVisible) return null;

          let popScale = 1;
          if (msg.pop) {
            const pd = msg.pop.delay ?? POP_DEFAULTS.delay;
            const ps = msg.pop.scale ?? POP_DEFAULTS.scale;
            const pg = msg.pop.growFrames ?? POP_DEFAULTS.growFrames;
            const ph = msg.pop.holdFrames ?? POP_DEFAULTS.holdFrames;
            const psh = msg.pop.shrinkFrames ?? POP_DEFAULTS.shrinkFrames;
            const popStart = msgStartFrame + pd;
            const growEnd = popStart + pg;
            const holdEnd = growEnd + ph;
            const shrinkEnd = holdEnd + psh;
            if (frame >= popStart && frame < growEnd) {
              popScale = interpolate(frame, [popStart, growEnd], [1, ps], { easing: Easing.out(Easing.cubic) });
            } else if (frame >= growEnd && frame < holdEnd) {
              popScale = ps;
            } else if (frame >= holdEnd && frame < shrinkEnd) {
              popScale = interpolate(frame, [holdEnd, shrinkEnd], [ps, 1], { easing: Easing.in(Easing.cubic) });
            }
          }
          const isPopping = popScale !== 1;

          return (
            <div key={i} style={{ position: "relative", zIndex: isPopping ? 5 : undefined }}>
              {showTyping && <TypingIndicator startFrame={typingStartFrame} />}
              {frame >= msgStartFrame && (
                <div style={{
                  display: "flex", justifyContent: msg.sent ? "flex-end" : "flex-start",
                  marginBottom: Math.round(18 * scale),
                }}>
                  <div style={{
                    maxWidth: BUBBLE_MAX_WIDTH,
                    backgroundColor: msg.sent ? COLOR_SENT_BUBBLE : COLOR_RECEIVED_BUBBLE,
                    borderRadius: msg.sent
                      ? bubbleRadius + "px 0 " + bubbleRadius + "px " + bubbleRadius + "px"
                      : "0 " + bubbleRadius + "px " + bubbleRadius + "px " + bubbleRadius + "px",
                    padding: Math.round(8 * scale) + "px " + Math.round(12 * scale) + "px " + Math.round(6 * scale) + "px",
                    position: "relative",
                    transform: isPopping ? "scale(" + popScale + ")" : undefined,
                    transformOrigin: msg.sent ? "center right" : "center left",
                  }}>
                    <svg
                      style={{
                        position: "absolute",
                        top: 0,
                        width: tailSize,
                        height: tailSize,
                        display: "block",
                        ...(msg.sent ? { right: -tailSize + 1 } : { left: -tailSize + 1 }),
                      }}
                      viewBox="0 0 10 10"
                    >
                      <path
                        d={msg.sent ? "M 0 0 L 10 0 L 0 10 Z" : "M 0 0 L 10 0 L 10 10 Z"}
                        fill={msg.sent ? COLOR_SENT_BUBBLE : COLOR_RECEIVED_BUBBLE}
                      />
                    </svg>
                    {msg.text && <span style={{ color: COLOR_TEXT, fontSize, lineHeight: 1.4, wordBreak: "break-word" }}>{renderTextWithEmoji(msg.text, fontSize)}</span>}
                    <span style={{
                      color: COLOR_TIME, fontSize: Math.round(17 * scale), marginLeft: Math.round(8 * scale),
                      float: "right", marginTop: Math.round(4 * scale), display: "flex", alignItems: "center", gap: Math.round(3 * scale),
                    }}>
                      {msg.time}
                      {msg.sent && (
                        <svg width={Math.round(16 * scale)} height={Math.round(11 * scale)} viewBox="0 0 16 11" fill="none">
                          <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.344.153.52.52 0 0 0 0 .688l2.357 2.547a.478.478 0 0 0 .336.178h.025a.478.478 0 0 0 .356-.178l6.543-8.076a.46.46 0 0 0-.05-.696z" fill="#53bdeb" />
                          <path d="M14.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.3" stroke="#53bdeb" strokeWidth=".7" fill="none" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: INPUT_HEIGHT,
        backgroundColor: COLOR_FOOTER_BG, display: "flex", alignItems: "center",
        padding: "0 " + Math.round(16 * scale) + "px", gap: Math.round(14 * scale),
      }}>
        <svg width={Math.round(32 * scale)} height={Math.round(32 * scale)} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M12 5v14M5 12h14" stroke={COLOR_ICON} strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div style={{
          flex: 1, height: Math.round(52 * scale), borderRadius: Math.round(26 * scale),
          backgroundColor: COLOR_INPUT_BG, display: "flex", alignItems: "center",
          padding: "0 " + Math.round(18 * scale) + "px", overflow: "hidden",
          gap: Math.round(10 * scale),
        }}>
          <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
            {typingText !== null ? (
              <span style={{ color: COLOR_TEXT, fontSize }}>
                {renderTextWithEmoji(typingText, fontSize)}
                <span style={{ opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0, fontWeight: 100 }}>|</span>
              </span>
            ) : null}
          </div>
          <svg width={Math.round(26 * scale)} height={Math.round(26 * scale)} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M4 4h16v10l-6 6H4z" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M14 20v-6h6" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>

        <svg width={Math.round(30 * scale)} height={Math.round(30 * scale)} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" stroke={COLOR_ICON} strokeWidth="1.5" />
          <text x="12" y="17" fontSize="13" fill={COLOR_ICON} textAnchor="middle" fontFamily={FONT} fontWeight="500">\u20B9</text>
        </svg>

        <svg width={Math.round(30 * scale)} height={Math.round(30 * scale)} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <rect x="3" y="7" width="18" height="13" rx="2" stroke={COLOR_ICON} strokeWidth="1.5" />
          <path d="M8 7l1.5-3h5L16 7" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="13.5" r="3.5" stroke={COLOR_ICON} strokeWidth="1.5" />
        </svg>

        <svg width={Math.round(26 * scale)} height={Math.round(26 * scale)} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <rect x="9" y="3" width="6" height="12" rx="3" stroke={COLOR_ICON} strokeWidth="1.5" />
          <path d="M5 11a7 7 0 0 0 14 0" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="19" x2="12" y2="22" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};`;

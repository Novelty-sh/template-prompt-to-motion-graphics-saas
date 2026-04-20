import type { ScreenTemplate } from "./index";

export const whatsappChatLightCode = `import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, Sequence } from "remotion";
import { Emoji, renderTextWithEmoji } from "@/lib/twemoji";

export const MyAnimation = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ===== DYNAMIC DATA (Replace this section based on user prompt) =====
  const CONTACT_NAME = "Alex Johnson";
  const CONTACT_AVATAR_URL = ""; // leave empty for default silhouette avatar
  const MESSAGES = [
    { text: "Hey! Are you coming tonight?", sent: false, time: "7:02 PM" },
    { text: "Yeah for sure! What time?", sent: true, time: "7:03 PM", status: "read" },
    { text: "Around 8ish. We're meeting at the usual spot", sent: false, time: "7:04 PM" },
    { text: "Should I bring anything?", sent: true, time: "7:05 PM", status: "read" },
    { text: "Maybe some drinks? \u{1F37B}", sent: false, time: "7:05 PM" },
    { text: "Got it! I'll grab some on the way", sent: true, time: "7:06 PM", status: "read" },
    { text: "Perfect \u{1F44C}", sent: false, time: "7:06 PM" },
    // For image messages, add imageUrl:
    // { text: "Check this out!", sent: true, time: "7:07 PM", status: "read", imageUrl: "https://..." },
  ];
  // ===== END DYNAMIC DATA =====

  // ===== TEMPLATE CONSTANTS (WhatsApp light theme) =====
  // DO NOT CHANGE WALLPAPER_URL — it is the official WhatsApp light doodle background.
  // Attached image URLs belong in CONTACT_AVATAR_URL or MESSAGES[].imageUrl, never here.
  const WALLPAPER_URL = "https://videos.novelty.sh/motion-graphics/wallpapers/whatsapp-light.png";
  const COLOR_BG = "#efeae2";
  const COLOR_SENT_BUBBLE = "#d9fdd3";
  const COLOR_RECEIVED_BUBBLE = "#ffffff";
  const COLOR_TEXT = "#111b21";
  const COLOR_TIME = "#667781";
  const COLOR_ICON = "#8696a0";
  const COLOR_TEAL_HEADER = "#075e54";
  const COLOR_TEAL_DARK = "#064e46";
  const COLOR_CHECK_READ = "#53bdeb";
  const COLOR_INPUT_BG = "#f0f2f5";
  const FONT = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const STATUS_BAR_HEIGHT = Math.round(height * 0.035);
  const HEADER_HEIGHT = Math.round(height * 0.07);
  const INPUT_HEIGHT = Math.round(height * 0.075);
  const BUBBLE_RADIUS = 7.5;
  // Sent-message typing (user types into input box): duration scales with sentence length,
  // but clamps so very short msgs are still visible and very long msgs don't drag. Full
  // sentence is ALWAYS displayed before the bubble appears.
  const TYPING_CHAR_SPEED = 1.2;
  const MIN_TYPING_DURATION = 12;
  const MAX_TYPING_DURATION = 48;
  const TYPED_HOLD_DURATION = 4;
  // Received-message typing dots: duration scales with the *incoming* message length.
  const DOTS_CHAR_SPEED = 0.5;
  const MIN_DOTS_DURATION = 15;
  const MAX_DOTS_DURATION = 45;
  const POST_MESSAGE_GAP = 6;
  const FADE_DURATION = 15;
  // ===== END TEMPLATE CONSTANTS =====

  const scale = Math.min(width / 420, height / 812);
  const fontSize = Math.round(14.2 * scale);
  const smallFontSize = Math.round(11 * scale);
  const padding = Math.round(14 * scale);

  // Get initials from contact name
  const initials = CONTACT_NAME.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // ===== CHAT TIMELINE =====
  // Each sent message is preceded by text typing into the input box; each received message
  // is preceded by a typing-dots indicator. Durations scale with the message's character
  // length so realistic pacing is preserved: longer message → longer wait.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // Number of frames used to animate characters into the input (excludes the post-typing hold)
  const getSentActiveFrames = (m) => clamp(Math.ceil(m.text.length * TYPING_CHAR_SPEED), MIN_TYPING_DURATION, MAX_TYPING_DURATION);
  // Total gap before a message's bubble appears (includes hold for sent msgs)
  const getPreBubbleDur = (m) => m.sent
    ? getSentActiveFrames(m) + TYPED_HOLD_DURATION
    : clamp(Math.ceil(m.text.length * DOTS_CHAR_SPEED), MIN_DOTS_DURATION, MAX_DOTS_DURATION);
  const messageStartFrames = [];
  {
    let acc = 0;
    for (let i = 0; i < MESSAGES.length; i++) {
      acc += getPreBubbleDur(MESSAGES[i]) + POST_MESSAGE_GAP;
      messageStartFrames.push(acc);
    }
  }

  // Find the text currently being typed into the input (null = show placeholder)
  // Full sentence is always displayed by the end of the active frames, then held briefly,
  // then the bubble appears and the input clears.
  let typingText = null;
  for (let i = 0; i < MESSAGES.length; i++) {
    const m = MESSAGES[i];
    if (!m.sent) continue;
    const msgStart = messageStartFrames[i];
    const preBubble = getPreBubbleDur(m);
    const typingStart = msgStart - preBubble;
    if (frame >= typingStart && frame < msgStart) {
      const chars = Array.from(m.text);
      const activeFrames = getSentActiveFrames(m);
      const localFrame = frame - typingStart;
      const charCount = localFrame >= activeFrames
        ? chars.length
        : Math.max(0, Math.min(chars.length, Math.floor((localFrame / activeFrames) * chars.length)));
      typingText = chars.slice(0, charCount).join("");
      break;
    }
  }

  // Check marks component
  const Checks = ({ status }) => {
    const checkColor = status === "read" ? COLOR_CHECK_READ : COLOR_ICON;
    const s = Math.round(16 * scale);
    if (status === "sent") {
      return (
        <svg width={s} height={Math.round(11 * scale)} viewBox="0 0 16 11" style={{ marginLeft: Math.round(3 * scale), flexShrink: 0 }}>
          <path d="M4.5 8.3L1.2 5l-.7.7L4.5 9.7l8-8-.7-.7z" fill={COLOR_ICON} />
        </svg>
      );
    }
    return (
      <svg width={s} height={Math.round(11 * scale)} viewBox="0 0 16 11" style={{ marginLeft: Math.round(3 * scale), flexShrink: 0 }}>
        <path d="M4.5 8.3L1.2 5l-.7.7L4.5 9.7l8-8-.7-.7z" fill={checkColor} />
        <path d="M7.5 8.3L4.2 5l-.7.7L7.5 9.7l8-8-.7-.7z" fill={checkColor} />
      </svg>
    );
  };

  // Typing indicator
  const TypingIndicator = ({ startFrame }) => {
    const localFrame = frame - startFrame;
    if (localFrame < 0) return null;
    const opacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const dots = [0, 1, 2].map(i => {
      const bounce = Math.sin(((localFrame * 0.3) + i * 1.2) % (Math.PI * 2));
      return interpolate(bounce, [-1, 1], [2, -5]);
    });
    return (
      <div style={{ display: "flex", marginTop: Math.round(4 * scale), opacity }}>
        <div style={{
          padding: \`\${Math.round(10 * scale)}px \${Math.round(16 * scale)}px\`,
          borderRadius: \`\${BUBBLE_RADIUS}px \${BUBBLE_RADIUS}px \${BUBBLE_RADIUS}px 0\`,
          backgroundColor: COLOR_RECEIVED_BUBBLE,
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
          display: "flex", gap: Math.round(4 * scale), alignItems: "center",
        }}>
          {dots.map((y, i) => (
            <div key={i} style={{ width: Math.round(7 * scale), height: Math.round(7 * scale), borderRadius: "50%", backgroundColor: "#93aab5", transform: \`translateY(\${y}px)\` }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR_BG, fontFamily: FONT, overflow: "hidden" }}>

      {/* ===== STATUS BAR ===== */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: STATUS_BAR_HEIGHT,
        backgroundColor: COLOR_TEAL_DARK, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: \`0 \${padding}px\`,
        fontSize: Math.round(12 * scale), color: "#fff", fontWeight: 500, zIndex: 20,
      }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: Math.round(5 * scale), alignItems: "center" }}>
          <svg width={Math.round(16 * scale)} height={Math.round(12 * scale)} viewBox="0 0 16 12" fill="#fff">
            <rect x="0" y="8" width="3" height="4" rx="0.5"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5"/>
            <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.35"/>
          </svg>
          <svg width={Math.round(25 * scale)} height={Math.round(12 * scale)} viewBox="0 0 25 12" fill="#fff">
            <rect x="0" y="1" width="21" height="10" rx="2" stroke="#fff" strokeWidth="1" fill="none"/>
            <rect x="22" y="3.5" width="2" height="5" rx="1" fill="#fff" opacity="0.4"/>
            <rect x="1.5" y="2.5" width="15" height="7" rx="1" fill="#fff"/>
          </svg>
        </div>
      </div>

      {/* ===== HEADER ===== */}
      <div style={{
        position: "absolute", top: STATUS_BAR_HEIGHT, left: 0, right: 0, height: HEADER_HEIGHT,
        backgroundColor: COLOR_TEAL_HEADER, display: "flex", alignItems: "center",
        padding: \`0 \${Math.round(6 * scale)}px 0 \${Math.round(2 * scale)}px\`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)", zIndex: 10,
      }}>
        {/* Back arrow */}
        <div style={{ display: "flex", alignItems: "center", padding: \`\${Math.round(8 * scale)}px \${Math.round(2 * scale)}px \${Math.round(8 * scale)}px \${Math.round(4 * scale)}px\` }}>
          <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill="#fff">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </div>

        {/* Avatar */}
        <div style={{
          width: Math.round(40 * scale), height: Math.round(40 * scale), borderRadius: "50%",
          backgroundColor: "#cfd8dc", display: "flex", alignItems: "center", justifyContent: "center",
          marginLeft: Math.round(2 * scale), flexShrink: 0, overflow: "hidden",
        }}>
          {CONTACT_AVATAR_URL ? (
            <Img src={CONTACT_AVATAR_URL} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width={Math.round(40 * scale)} height={Math.round(40 * scale)} viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="20" fill="#cfd8dc"/>
              <circle cx="20" cy="16" r="7" fill="#a4b0b6"/>
              <ellipse cx="20" cy="34" rx="12" ry="9" fill="#a4b0b6"/>
            </svg>
          )}
        </div>

        {/* Name & status */}
        <div style={{ flex: 1, marginLeft: Math.round(10 * scale), overflow: "hidden" }}>
          <div style={{ fontSize: Math.round(17 * scale), color: "#fff", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {CONTACT_NAME}
          </div>
          <div style={{ fontSize: Math.round(13 * scale), color: "rgba(255,255,255,0.7)", marginTop: -1 }}>online</div>
        </div>

        {/* Action icons */}
        <div style={{ display: "flex", gap: Math.round(2 * scale) }}>
          <div style={{ width: Math.round(40 * scale), height: Math.round(40 * scale), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill="#fff"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          </div>
          <div style={{ width: Math.round(40 * scale), height: Math.round(40 * scale), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
          </div>
          <div style={{ width: Math.round(40 * scale), height: Math.round(40 * scale), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill="#fff"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </div>
        </div>
      </div>

      {/* ===== CHAT AREA ===== */}
      <div style={{
        position: "absolute", top: STATUS_BAR_HEIGHT + HEADER_HEIGHT, left: 0, right: 0, bottom: INPUT_HEIGHT,
        overflow: "hidden", backgroundColor: COLOR_BG,
      }}>
        {/* WhatsApp light wallpaper — DO NOT change WALLPAPER_URL */}
        <Img src={WALLPAPER_URL} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, padding: \`\${Math.round(8 * scale)}px \${padding}px \${Math.round(10 * scale)}px\`, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>

          {/* Encryption notice */}
          <div style={{
            textAlign: "center", margin: \`\${Math.round(6 * scale)}px auto \${Math.round(8 * scale)}px\`, maxWidth: Math.round(340 * scale),
            backgroundColor: "#ffeed4", borderRadius: Math.round(6 * scale), padding: \`\${Math.round(6 * scale)}px \${Math.round(10 * scale)}px\`,
            fontSize: Math.round(12 * scale), color: "#54656f", lineHeight: 1.45,
          }}>
            {renderTextWithEmoji("\u{1F512} Messages and calls are end-to-end encrypted. Tap to learn more.", Math.round(12 * scale))}
          </div>

          {/* Date pill */}
          <div style={{ textAlign: "center", margin: \`\${Math.round(8 * scale)}px 0 \${Math.round(6 * scale)}px\` }}>
            <span style={{
              backgroundColor: "#fff", padding: \`\${Math.round(4 * scale)}px \${Math.round(12 * scale)}px\`,
              borderRadius: Math.round(7 * scale), fontSize: Math.round(12.5 * scale), color: "#54656f",
              display: "inline-block", boxShadow: "0 1px 0.5px rgba(0,0,0,0.1)",
              textTransform: "uppercase", letterSpacing: 0.2,
            }}>Today</span>
          </div>

          {/* Messages */}
          {MESSAGES.map((msg, i) => {
            const prevSame = i > 0 && MESSAGES[i - 1].sent === msg.sent;
            const msgStartFrame = messageStartFrames[i];
            const isReceived = !msg.sent;

            // Typing indicator before received messages (duration scales with msg length)
            const dotsDur = getPreBubbleDur(msg);
            const showTyping = isReceived && frame >= msgStartFrame - dotsDur && frame < msgStartFrame;

            const opacity = interpolate(frame - msgStartFrame, [0, FADE_DURATION], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const bounce = spring({ frame: Math.max(0, frame - msgStartFrame), fps, config: { damping: 14, stiffness: 180 } });
            const scaleVal = interpolate(bounce, [0, 1], [0.95, 1]);

            return (
              <div key={i}>
                {showTyping && <TypingIndicator startFrame={msgStartFrame - dotsDur} />}
                <div style={{
                  display: "flex", justifyContent: msg.sent ? "flex-end" : "flex-start",
                  marginTop: prevSame ? Math.round(2 * scale) : Math.round(6 * scale),
                  opacity,
                  transform: \`scale(\${scaleVal})\`,
                  transformOrigin: msg.sent ? "100% 100%" : "0% 100%",
                }}>
                  <div style={{ position: "relative", maxWidth: "80%", minWidth: Math.round(80 * scale) }}>
                    {/* Bubble tail */}
                    {!prevSame && (
                      <div style={{
                        position: "absolute", top: 0,
                        [msg.sent ? "right" : "left"]: Math.round(-8 * scale),
                        width: 0, height: 0,
                        borderTop: \`\${Math.round(8 * scale)}px solid \${msg.sent ? COLOR_SENT_BUBBLE : COLOR_RECEIVED_BUBBLE}\`,
                        [msg.sent ? "borderLeft" : "borderRight"]: \`\${Math.round(8 * scale)}px solid transparent\`,
                      }} />
                    )}
                    <div style={{
                      padding: msg.imageUrl
                        ? \`\${Math.round(4 * scale)}px \${Math.round(4 * scale)}px \${Math.round(6 * scale)}px\`
                        : \`\${Math.round(5 * scale)}px \${Math.round(7 * scale)}px \${Math.round(6 * scale)}px \${Math.round(9 * scale)}px\`,
                      borderRadius: BUBBLE_RADIUS,
                      borderTopLeftRadius: !msg.sent && !prevSame ? 0 : BUBBLE_RADIUS,
                      borderTopRightRadius: msg.sent && !prevSame ? 0 : BUBBLE_RADIUS,
                      backgroundColor: msg.sent ? COLOR_SENT_BUBBLE : COLOR_RECEIVED_BUBBLE,
                      boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
                      overflow: "hidden",
                    }}>
                      {msg.imageUrl && (
                        <Img src={msg.imageUrl} style={{ width: "100%", borderRadius: Math.round(6 * scale), marginBottom: msg.text ? Math.round(4 * scale) : 0, display: "block" }} />
                      )}
                      {msg.text && (
                        <span style={{ fontSize, color: COLOR_TEXT, lineHeight: 1.35, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                          {renderTextWithEmoji(msg.text, fontSize)}
                        </span>
                      )}
                      <span style={{
                        float: "right", marginLeft: Math.round(8 * scale), marginTop: Math.round(4 * scale),
                        display: "flex", alignItems: "center", gap: 1, lineHeight: 1,
                      }}>
                        <span style={{ fontSize: smallFontSize, color: COLOR_TIME }}>{msg.time}</span>
                        {msg.sent && <Checks status={msg.status || "read"} />}
                      </span>
                      <div style={{ clear: "both" }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== INPUT BAR ===== */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: INPUT_HEIGHT,
        display: "flex", alignItems: "center", gap: Math.round(6 * scale),
        padding: \`\${Math.round(5 * scale)}px \${Math.round(6 * scale)}px \${Math.round(8 * scale)}px\`,
        backgroundColor: COLOR_INPUT_BG,
      }}>
        {/* Left pill input */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          backgroundColor: "#fff", borderRadius: Math.round(24 * scale),
          padding: \`0 \${Math.round(6 * scale)}px\`, minHeight: Math.round(44 * scale),
          boxShadow: "0 1px 1px rgba(0,0,0,0.06)",
        }}>
          {/* Emoji icon */}
          <div style={{ width: Math.round(36 * scale), height: Math.round(36 * scale), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width={Math.round(24 * scale)} height={Math.round(24 * scale)} viewBox="0 0 24 24" fill={COLOR_ICON}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
          </div>
          {/* Placeholder / live typing text */}
          <div style={{
            flex: 1, fontSize: Math.round(16.5 * scale),
            color: typingText !== null ? COLOR_TEXT : COLOR_ICON,
            padding: \`\${Math.round(8 * scale)}px 0\`,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip",
          }}>
            {typingText !== null ? renderTextWithEmoji(typingText, Math.round(16.5 * scale)) : "Message"}
          </div>
          {/* Attach icon */}
          <div style={{ width: Math.round(36 * scale), height: Math.round(36 * scale), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill={COLOR_ICON} style={{ transform: "rotate(45deg)" }}>
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
          </div>
          {/* Camera icon */}
          <div style={{ width: Math.round(36 * scale), height: Math.round(36 * scale), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width={Math.round(22 * scale)} height={Math.round(22 * scale)} viewBox="0 0 24 24" fill={COLOR_ICON}>
              <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/>
              <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
            </svg>
          </div>
        </div>

        {/* Mic button */}
        <div style={{
          width: Math.round(48 * scale), height: Math.round(48 * scale), borderRadius: "50%",
          backgroundColor: COLOR_TEAL_HEADER, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}>
          <svg width={Math.round(24 * scale)} height={Math.round(24 * scale)} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;

export const whatsappChatLightTemplate: ScreenTemplate = {
  id: "whatsapp-chat-light",
  name: "WhatsApp Chat (Light Theme)",
  description:
    "WhatsApp light theme chat screen with status bar, teal header, message tails, encryption notice, date pill, check marks (sent/delivered/read), typing indicator, and input bar. Pixel-accurate to the real WhatsApp mobile UI.",
  triggerKeywords: [
    "whatsapp light",
    "whatsapp light theme",
    "whatsapp white",
    "whatsapp mobile",
  ],
  code: whatsappChatLightCode,
  dynamicDataContract: `- CONTACT_NAME: string — the chat contact's display name
- CONTACT_AVATAR_URL: string — URL for the contact's profile photo. Use an attached image URL if the user provided a portrait/face photo, otherwise leave empty for default WhatsApp silhouette avatar.
- MESSAGES: array of { text: string, sent: boolean, time: string, status?: string, imageUrl?: string }
  - \`sent: true\` = right-aligned light green bubble (user), \`sent: false\` = left-aligned white bubble (contact)
  - \`status\`: "sent" (single gray check), "delivered" (double gray check), "read" (double blue check). Only applies to sent messages.
  - \`imageUrl\`: optional URL for image messages. Shows the image inside the bubble.
  - Generate realistic, natural messages based on the user's prompt.`,
  guidelines: `### WhatsApp Light Theme Visual Rules
- **Font**: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif — this is the authentic WhatsApp font stack
- **Message font size**: 14.2px (scaled), line-height 1.35 — do NOT change these
- **Sent bubble**: #d9fdd3 (light green), received bubble: #ffffff (white)
- **Text color**: #111b21 (near-black), time color: #667781 (gray)
- **Header**: #075e54 (teal), status bar: #064e46 (dark teal)
- **Check marks**: sent = single gray (#8696a0), delivered = double gray, read = double blue (#53bdeb)
- **Bubble tails**: Triangles on the first message in a consecutive group from the same sender. No tail on subsequent messages.
- **Bubble radius**: 7.5px, with top-left or top-right set to 0 when tail is shown
- **Encryption notice**: Yellow-ish background #ffeed4, always shown above messages
- **Date pill**: White background, centered, "Today" in uppercase
- **Input bar**: #f0f2f5 background, white pill input with emoji/attach/camera icons, teal mic button`,
  durationInFrames: 300,
  fps: 30,
};

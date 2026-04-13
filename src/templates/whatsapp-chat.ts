import type { ScreenTemplate } from "./index";

export const whatsappChatCode = `import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, Sequence } from "remotion";

export const MyAnimation = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ===== DYNAMIC DATA (Replace this section based on user prompt) =====
  const CONTACT_NAME = "Alice";
  const CONTACT_AVATAR_URL = ""; // leave empty to show initials, or use an attached image URL
  const MESSAGES = [
    { text: "Hey! How are you?", sent: false, time: "10:30 AM" },
    { text: "I'm good, thanks! Just finishing up some work.", sent: true, time: "10:31 AM" },
    { text: "Want to grab coffee later?", sent: false, time: "10:32 AM" },
    { text: "Sure! Let's meet at 3pm", sent: true, time: "10:33 AM" },
    { text: "Perfect, see you there! \u2615", sent: false, time: "10:33 AM" },
    // For image messages, add imageUrl:
    // { text: "Check this out!", sent: true, time: "10:34 AM", imageUrl: "https://..." },
  ];
  // ===== END DYNAMIC DATA =====

  // ===== TEMPLATE CONSTANTS (WhatsApp dark theme) =====
  const COLOR_BG = "#0b141a";
  const COLOR_HEADER = "#1f2c34";
  const COLOR_SENT_BUBBLE = "#005c4b";
  const COLOR_RECEIVED_BUBBLE = "#202c33";
  const COLOR_TEXT = "#e9edef";
  const COLOR_TIME = "#ffffff99";
  const COLOR_INPUT_BG = "#2a3942";
  const COLOR_ICON = "#8696a0";
  const COLOR_GREEN = "#00a884";
  const FONT = "Inter, system-ui, -apple-system, sans-serif";
  const HEADER_HEIGHT = Math.round(height * 0.08);
  const INPUT_HEIGHT = Math.round(height * 0.07);
  const BUBBLE_MAX_WIDTH = "75%";
  const BUBBLE_RADIUS = 12;
  const STAGGER_DELAY = 35;
  const FADE_DURATION = 15;
  // ===== END TEMPLATE CONSTANTS =====

  const scale = Math.min(width / 1080, height / 1920);
  const fontSize = Math.round(16 * scale);
  const smallFontSize = Math.round(12 * scale);
  const padding = Math.round(16 * scale);

  // Get initials from contact name
  const initials = CONTACT_NAME.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // Typing indicator component
  const TypingIndicator = ({ startFrame }) => {
    const localFrame = frame - startFrame;
    if (localFrame < 0) return null;
    const opacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const dots = [0, 1, 2].map(i => {
      const bounce = Math.sin(((localFrame * 0.3) + i * 1.2) % (Math.PI * 2));
      const y = interpolate(bounce, [-1, 1], [2, -4]);
      return y;
    });
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: padding, paddingRight: padding, marginBottom: Math.round(6 * scale), opacity }}>
        <div style={{ backgroundColor: COLOR_RECEIVED_BUBBLE, borderRadius: BUBBLE_RADIUS, padding: \`\${Math.round(10 * scale)}px \${Math.round(14 * scale)}px\`, display: "flex", gap: Math.round(4 * scale), alignItems: "center" }}>
          {dots.map((y, i) => (
            <div key={i} style={{ width: Math.round(8 * scale), height: Math.round(8 * scale), borderRadius: "50%", backgroundColor: COLOR_ICON, transform: \`translateY(\${y}px)\` }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR_BG, fontFamily: FONT, overflow: "hidden" }}>
      {/* Wallpaper subtle pattern */}
      <AbsoluteFill style={{ opacity: 0.03, backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: \`\${Math.round(24 * scale)}px \${Math.round(24 * scale)}px\` }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: HEADER_HEIGHT,
        backgroundColor: COLOR_HEADER, display: "flex", alignItems: "center",
        padding: \`0 \${padding}px\`, gap: Math.round(12 * scale), zIndex: 10,
      }}>
        {/* Back arrow */}
        <svg width={Math.round(24 * scale)} height={Math.round(24 * scale)} viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke={COLOR_TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Avatar */}
        <div style={{
          width: Math.round(40 * scale), height: Math.round(40 * scale), borderRadius: "50%",
          backgroundColor: COLOR_GREEN, display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          {CONTACT_AVATAR_URL ? (
            <Img src={CONTACT_AVATAR_URL} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "#fff", fontSize: Math.round(16 * scale), fontWeight: 600 }}>{initials}</span>
          )}
        </div>

        {/* Contact info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: COLOR_TEXT, fontSize: Math.round(17 * scale), fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{CONTACT_NAME}</div>
          <div style={{ color: COLOR_TIME, fontSize: smallFontSize }}>online</div>
        </div>

        {/* Header icons */}
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
        padding: \`\${padding}px \${padding}px \${Math.round(8 * scale)}px\`,
        overflow: "hidden",
      }}>
        {MESSAGES.map((msg, i) => {
          const msgStartFrame = i * STAGGER_DELAY;
          const isReceived = !msg.sent;

          // Show typing indicator before received messages
          const showTyping = isReceived && frame >= msgStartFrame - 20 && frame < msgStartFrame;

          const opacity = interpolate(frame - msgStartFrame, [0, FADE_DURATION], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const slideX = interpolate(opacity, [0, 1], [msg.sent ? 30 : -30, 0]);
          const bounce = spring({ frame: Math.max(0, frame - msgStartFrame), fps, config: { damping: 14, stiffness: 180 } });
          const scaleVal = interpolate(bounce, [0, 1], [0.95, 1]);

          return (
            <div key={i}>
              {showTyping && <TypingIndicator startFrame={msgStartFrame - 20} />}
              <div style={{
                display: "flex", justifyContent: msg.sent ? "flex-end" : "flex-start",
                marginBottom: Math.round(6 * scale), opacity,
                transform: \`translateX(\${slideX}px) scale(\${scaleVal})\`,
                transformOrigin: msg.sent ? "100% 100%" : "0% 100%",
              }}>
                <div style={{
                  maxWidth: BUBBLE_MAX_WIDTH,
                  backgroundColor: msg.sent ? COLOR_SENT_BUBBLE : COLOR_RECEIVED_BUBBLE,
                  borderRadius: BUBBLE_RADIUS,
                  padding: msg.imageUrl ? \`\${Math.round(4 * scale)}px \${Math.round(4 * scale)}px \${Math.round(6 * scale)}px\` : \`\${Math.round(8 * scale)}px \${Math.round(12 * scale)}px \${Math.round(6 * scale)}px\`,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {msg.imageUrl && (
                    <Img src={msg.imageUrl} style={{ width: "100%", borderRadius: Math.round(8 * scale), marginBottom: msg.text ? Math.round(6 * scale) : 0, display: "block" }} />
                  )}
                  {msg.text && <span style={{ color: COLOR_TEXT, fontSize, lineHeight: 1.4, wordBreak: "break-word", padding: msg.imageUrl ? \`0 \${Math.round(8 * scale)}px\` : undefined }}>{msg.text}</span>}
                  <span style={{
                    color: COLOR_TIME, fontSize: Math.round(11 * scale), marginLeft: Math.round(8 * scale),
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
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: INPUT_HEIGHT,
        backgroundColor: COLOR_HEADER, display: "flex", alignItems: "center",
        padding: \`0 \${Math.round(8 * scale)}px\`, gap: Math.round(8 * scale),
      }}>
        {/* Emoji icon */}
        <svg width={Math.round(24 * scale)} height={Math.round(24 * scale)} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={COLOR_ICON} strokeWidth="1.5" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke={COLOR_ICON} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9" cy="10" r="1" fill={COLOR_ICON} />
          <circle cx="15" cy="10" r="1" fill={COLOR_ICON} />
        </svg>

        {/* Text input */}
        <div style={{
          flex: 1, height: Math.round(36 * scale), borderRadius: Math.round(20 * scale),
          backgroundColor: COLOR_INPUT_BG, display: "flex", alignItems: "center",
          padding: \`0 \${Math.round(12 * scale)}px\`,
        }}>
          <span style={{ color: COLOR_ICON, fontSize }}>Type a message</span>
        </div>

        {/* Mic icon */}
        <div style={{
          width: Math.round(40 * scale), height: Math.round(40 * scale), borderRadius: "50%",
          backgroundColor: COLOR_GREEN, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width={Math.round(20 * scale)} height={Math.round(20 * scale)} viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#fff" />
            <path d="M5 10a7 7 0 0 0 14 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="19" x2="12" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;

export const whatsappChatTemplate: ScreenTemplate = {
  id: "whatsapp-chat",
  name: "WhatsApp Chat",
  description:
    "WhatsApp dark theme chat screen with header, message bubbles, typing indicator, and input bar. Messages animate in with staggered slide + spring bounce.",
  triggerKeywords: [
    "whatsapp",
    "whatsapp chat",
    "whatsapp conversation",
    "whatsapp message",
  ],
  code: whatsappChatCode,
  dynamicDataContract: `- CONTACT_NAME: string — the chat contact's display name
- CONTACT_AVATAR_URL: string — URL for the contact's profile photo. Use an attached image URL if the user provided a portrait/face photo, otherwise leave empty to show initials.
- MESSAGES: array of { text: string, sent: boolean, time: string, imageUrl?: string } — the conversation messages. \`sent: true\` = right-aligned green bubble (user), \`sent: false\` = left-aligned dark bubble (contact). For image messages, set \`imageUrl\` to an attached image URL and optionally include a caption in \`text\`. Generate realistic, natural messages based on the user's prompt.`,
  durationInFrames: 300,
  fps: 30,
};

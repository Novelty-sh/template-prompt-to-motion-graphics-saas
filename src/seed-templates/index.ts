import { whatsappChatLightCode } from "@/templates/whatsapp-chat-light";
import { whatsappChatDarkSeedCode } from "./whatsapp-chat-dark-code";

export interface SeedTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  fps: number;
  durationInFrames: number;
  code: string;
  defaultModel: string;
}

export const seedTemplates: SeedTemplate[] = [
  {
    id: "whatsapp-chat-light",
    name: "WhatsApp Chat (Light)",
    description:
      "Animated WhatsApp light-theme chat. Edit the messages, contact name, or pacing with a single prompt.",
    thumbnail: "/ws-light-theme.png",
    aspectRatio: "9:16",
    fps: 30,
    durationInFrames: 300,
    code: whatsappChatLightCode,
    defaultModel: "bedrock:claude-sonnet-4-6",
  },
  {
    id: "whatsapp-chat-dark",
    name: "WhatsApp Chat (Dark)",
    description:
      "Animated WhatsApp dark-theme chat. Edit the messages, contact name, or pacing with a single prompt.",
    thumbnail: "/ws-dark-theme.jpg",
    aspectRatio: "9:16",
    fps: 30,
    durationInFrames: 300,
    code: whatsappChatDarkSeedCode,
    defaultModel: "bedrock:claude-sonnet-4-6",
  },
];

export function getSeedTemplateById(id: string): SeedTemplate | undefined {
  return seedTemplates.find((t) => t.id === id);
}

import { whatsappChatTemplate } from "./whatsapp-chat";
import { whatsappChatLightTemplate } from "./whatsapp-chat-light";

export interface ScreenTemplate {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  code: string;
  dynamicDataContract: string;
  /** Styling guidelines the LLM should follow when editing template-based code */
  guidelines?: string;
  durationInFrames: number;
  fps: number;
}

export const templates: ScreenTemplate[] = [
  whatsappChatTemplate,
  whatsappChatLightTemplate,
];

export function getTemplateById(id: string): ScreenTemplate | undefined {
  return templates.find((t) => t.id === id);
}

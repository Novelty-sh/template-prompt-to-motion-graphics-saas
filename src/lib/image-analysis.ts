/**
 * Analyzes attached images using Gemini vision.
 * Returns a one-sentence description for each image so the LLM can
 * intelligently decide how to use them in templates.
 */

import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Describe each image in one sentence.
 * Sends all images in a single API call to minimize latency.
 */
export async function analyzeImages(
  base64Images: string[],
  visionModel: LanguageModel,
): Promise<string[]> {
  const imageContent = base64Images.map((img, i) => [
    {
      type: "text" as const,
      text: `Image ${i + 1}:`,
    },
    {
      type: "image" as const,
      image: img,
    },
  ]).flat();

  const result = await generateObject({
    model: visionModel,
    system:
      "You analyze images and provide brief, factual descriptions. " +
      "For each image, describe what it shows in one sentence. " +
      "Focus on: is it a person/portrait (mention gender, age range), a photo/scene, a screenshot, a logo, etc.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Describe each of the following ${base64Images.length} image(s) in one sentence each.`,
          },
          ...imageContent,
        ],
      },
    ],
    schema: z.object({
      descriptions: z
        .array(z.string())
        .describe("One-sentence description for each image, in order"),
    }),
  });

  return result.object.descriptions;
}

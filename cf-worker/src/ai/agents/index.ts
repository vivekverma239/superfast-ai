import { convertToModelMessages, streamText, UIMessage } from "ai";
import {
  AI_MODEL,
  getAILLM,
  OPENROUTER_MODEL,
  streamTextWrapper,
} from "../aisdk";

export const generalAgent = async ({
  messages,
  model,
  reasoningLevel,
}: {
  messages: UIMessage[];
  model: AI_MODEL | OPENROUTER_MODEL;
  reasoningLevel: "none" | "default" | "high";
}) => {
  const systemPrompt = `
    You are an helpful assistant that can help with a wide range of tasks.
    `;

  const llm = getAILLM(model ?? AI_MODEL.GEMINI_2_5_FLASH);
  const response = await streamText({
    model: llm,
    messages: convertToModelMessages(messages),
    system: systemPrompt,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 2048,
          includeThoughts: true,
        },
      },
    },
  });
  return response.toUIMessageStreamResponse({ sendReasoning: true });
};

import {
  createGoogleGenerativeAI,
  GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  generateObject,
  generateText,
  ModelMessage,
  stepCountIs,
  StepResult,
  streamText,
  SystemModelMessage,
  ToolSet,
  UIMessage,
  LanguageModel,
} from "ai";
import { z } from "zod";
import { err, ok, Result } from "neverthrow";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { perplexity } from "@ai-sdk/perplexity";
import { v4 as uuidv4 } from "uuid";
import { addModelUsage } from "../utils/tokenTracker";
import { logger } from "hono/logger";

export enum AI_MODEL {
  GEMINI_1_5_PRO = "gemini-1.5-pro",
  // GEMINI_2_0_FLASH = "gemini-2.0-flash",
  GEMINI_2_0_FLASH = "gemini-2.0-flash",

  // GEMINI_2_5_PRO = "gemini-2.5-pro-preview-03-25",
  GEMINI_2_5_PRO = "gemini-2.5-pro",

  // GEMINI_2_5_FLASH = "gemini-2.5-flash-preview-04-17",
  GEMINI_2_5_FLASH = "gemini-flash-latest",
  GEMINI_2_5_FLASH_LITE = "gemini-flash-lite-latest",

  GEMINI_2_5_FLASH_SEARCH = "gemini-2.5-flash-search",

  GPT_4_1 = "gpt-4.1-2025-04-14",
  GPT_4_1_MINI = "gpt-4.1-mini-2025-04-14",
  GPT_4_1_NANO = "gpt-4.1-nano-2025-04-14",
  O4_MINI = "o4-mini-2025-04-16",
  O3 = "o3",
  GPT_5_MINI = "gpt-5-mini-2025-08-07",
  GPT_5 = "gpt-5-2025-08-07",
  GPT_5_NANO = "gpt-5-nano-2025-08-07",
  CLAUDE_4_SONNET = "claude-sonnet-4-20250514",
  PERPLEXITY_SONAR = "sonar",
}
export enum OPENROUTER_MODEL {
  GROK_4 = "x-ai/grok-4",
  KIMI_K2 = "moonshotai/kimi-k2",
  CLAUDE_3_7_SONNET = "anthropic/claude-3.7-sonnet",
  CLAUDE_4_SONNET = "anthropic/claude-sonnet-4",
  CLAUDE_3_5_SONNET = "anthropic/claude-3.5-sonnet",
  PERPLEXITY_SONAR = "perplexity/sonar",
  GLM_4_5 = "z-ai/glm-4.5",
  QWEN_3_235B_A22B_2507 = "qwen/qwen3-235b-a22b-2507",
  GPT_OSS_120B = "openai/gpt-oss-120b",
  DEEPSEEK_R1_0528 = "deepseek/deepseek-r1-0528",
  GROK_4_FAST = "x-ai/grok-4-fast",
}

export const REASONING_MODELS: (AI_MODEL | OPENROUTER_MODEL)[] = [
  AI_MODEL.GEMINI_2_5_FLASH,
  AI_MODEL.GEMINI_2_5_PRO,
  AI_MODEL.O4_MINI,
  AI_MODEL.CLAUDE_4_SONNET,
  OPENROUTER_MODEL.GROK_4_FAST,
];

/**
 * Get an AI LLM model
 * @param model - The model to use
 * @returns The LLM model
 */
export const getAILLM = (model: AI_MODEL | OPENROUTER_MODEL): LanguageModel => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (model === AI_MODEL.GEMINI_2_0_FLASH) {
    return google(model);
  }

  if (model === AI_MODEL.GEMINI_2_5_FLASH) {
    return google(model);
  }

  if (model === AI_MODEL.GEMINI_2_5_FLASH_SEARCH) {
    return google(model);
  }

  if (model === AI_MODEL.GPT_4_1) {
    return openai(model);
  }

  if (model === AI_MODEL.GPT_4_1_MINI) {
    return openai(model);
  }

  if (model === AI_MODEL.GPT_4_1_NANO) {
    return openai(model);
  }

  if (model === AI_MODEL.O4_MINI) {
    return openai(model);
  }

  if (model === AI_MODEL.CLAUDE_4_SONNET) {
    return anthropic(model);
  }

  if (model === OPENROUTER_MODEL.CLAUDE_3_7_SONNET) {
    return openrouter(model);
  }

  if (model === OPENROUTER_MODEL.CLAUDE_4_SONNET) {
    return openrouter(model);
  }

  if (model === OPENROUTER_MODEL.CLAUDE_3_5_SONNET) {
    return openrouter(model);
  }

  if (model === OPENROUTER_MODEL.GROK_4) {
    return openrouter(model);
  }

  if (model === OPENROUTER_MODEL.KIMI_K2) {
    return openrouter(model, {
      extraBody: {
        provider: {
          sort: "throughput",
        },
      },
    });
  }

  if (model === OPENROUTER_MODEL.GPT_OSS_120B) {
    return openrouter(model, {
      extraBody: {
        provider: {
          sort: "throughput",
          only: ["cerebras"],
        },
      },
    });
  }

  if (model === OPENROUTER_MODEL.DEEPSEEK_R1_0528) {
    return openrouter(model, {
      extraBody: {
        provider: {
          sort: "throughput",
        },
      },
    });
  }

  if (model === OPENROUTER_MODEL.PERPLEXITY_SONAR) {
    return openrouter(model);
  }

  if (model === OPENROUTER_MODEL.GLM_4_5) {
    return openrouter(model);
  }

  if (model === OPENROUTER_MODEL.QWEN_3_235B_A22B_2507) {
    return openrouter(model, {
      extraBody: {
        provider: {
          sort: "throughput",
          only: ["cerebras"],
        },
      },
    });
  }

  if (model === AI_MODEL.PERPLEXITY_SONAR) {
    return perplexity(model);
  }

  if (model === AI_MODEL.O3) {
    return openai(model);
  }

  if (model.includes("gpt-5")) {
    return openai(model);
  }

  if (model === OPENROUTER_MODEL.GROK_4_FAST) {
    return openrouter(model, {
      reasoning: {
        enabled: true,
        max_tokens: 2048,
      },
    });
  }

  return google(model);
};

/**
 * Get the provider options for a model
 * @param model - The model to use
 * @param reasoningLevel - The reasoning level to use
 * @returns The provider options
 */
export const getProviderOptions = (
  model: AI_MODEL | OPENROUTER_MODEL,
  reasoningLevel: "none" | "default" | "high"
) => {
  if (!REASONING_MODELS.includes(model)) {
    return undefined;
  }

  return {
    google: {
      thinkingConfig: {
        thinkingBudget:
          reasoningLevel === "high"
            ? 512
            : reasoningLevel === "default"
            ? 256
            : 0,
        includeThoughts: true,
      },
    } satisfies GoogleGenerativeAIProviderOptions,
    openai: {
      reasoningEffort:
        reasoningLevel === "high"
          ? "high"
          : reasoningLevel === "default"
          ? "medium"
          : "low",
    },
    openrouter: {
      reasoning: {
        enabled: true,
        max_tokens: 2048,
      },
    },
  };
};

/**
 * Generate text with a wrapper
 * @param model - The model to use
 * @param messages - The messages to send to the model
 * @param systemPrompt - The system prompt to send to the model
 * @param reasoningLevel - The reasoning level to use
 * @param tools - The tools to use
 * @returns The response from the model
 */
export const generateTextWrapper = async ({
  model,
  messages,
  systemPrompt,
  reasoningLevel = "none",
  tools,
}: {
  model: AI_MODEL | OPENROUTER_MODEL;
  messages: ModelMessage[];
  systemPrompt: string;
  reasoningLevel: "none" | "default" | "high";
  tools?: ToolSet;
  userID?: string;
  sessionID?: string;
  lastMessageID?: string;
  onStepFinishCallback?: (stepResult: StepResult<ToolSet>) => void;
}) => {
  // Check if last message is a assistant message
  if (messages[messages.length - 1]?.role === "assistant") {
    messages.push({
      role: "user",
      content: `<system>No message from user, please send a message in continuation of the conversation and system message.</system>`,
    });
  }

  // Check if system prompt is not attached
  if (messages[0]?.role !== "system") {
    messages.unshift({
      role: "system",
      content: systemPrompt,
    });
  }

  const llm = getAILLM(model);
  const providerOptions = getProviderOptions(model, reasoningLevel);

  try {
    const response = await generateText({
      model: llm,
      messages: messages,
      tools,
      providerOptions: providerOptions,
      stopWhen: stepCountIs(10),
      maxRetries: 3,
    });
    return ok(response);
  } catch (error) {
    console.error(error);
    return err(error);
  }
};

/**
 * Generate an object with a wrapper
 * @param model - The model to use
 * @param messages - The messages to send to the model
 * @param schema - The schema to use
 * @param systemPrompt - The system prompt to send to the model
 * @param reasoningLevel - The reasoning level to use
 * @returns The response from the model
 */
export const generateObjectWrapper = async <T>({
  model,
  messages,
  schema,
  reasoningLevel = "none",
}: {
  model: AI_MODEL | OPENROUTER_MODEL;
  messages: ModelMessage[];
  schema: z.ZodObject;
  reasoningLevel: "none" | "default" | "high";
  functionName?: string;
}): Promise<Result<T, Error>> => {
  const llm = getAILLM(model);

  let retryCount = 0;
  while (retryCount < 3) {
    try {
      const providerOptions = getProviderOptions(model, reasoningLevel);
      const response = await generateObject({
        model: llm,
        messages: messages,
        schema: schema,
        providerOptions: providerOptions,
        maxRetries: 3,
        maxOutputTokens: 12000,
        //   experimental_telemetry: {
        //     isEnabled: true,
        //     tracer: getTracer(),
        //   },
      });
      addModelUsage(model, response.usage);
      return ok(response.object as T);
    } catch (error) {
      console.error(error);
      retryCount++;
      if (retryCount === 3) {
        return err(error as Error);
      }
    }
  }
  return err(new Error("Failed to generate object"));
};

export const streamTextWrapper = async ({
  model,
  messages,
  systemPrompt,
  reasoningLevel = "none",
  tools,
  onFinish,
  requestHeaders,
}: {
  model: AI_MODEL | OPENROUTER_MODEL;
  messages: UIMessage[];
  systemPrompt: string;
  reasoningLevel: "none" | "default" | "high";
  tools?: ToolSet;
  onFinish: (responseMessage: UIMessage) => Promise<void>;
  requestHeaders?: Headers;
}) => {
  const llm = getAILLM(model);
  const providerOptions = getProviderOptions(model, reasoningLevel);

  const modelMessages = convertToModelMessages(messages);
  if (modelMessages[0]?.role !== "system") {
    modelMessages.unshift({
      role: "system",
      content: systemPrompt,
    } as SystemModelMessage);
  }
  let retryCount = 0;

  while (retryCount < 3) {
    try {
      const response = streamText({
        model: llm,
        messages: modelMessages,
        tools,
        providerOptions: providerOptions,
        stopWhen: stepCountIs(100),
        maxRetries: 3,
      });

      const origin = requestHeaders?.get("Origin") ?? "*";
      const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      };
      const streamResponse = response.toUIMessageStreamResponse({
        originalMessages: messages, // Pass original messages for context
        generateMessageId: () => uuidv4().toString(), // ID generation moved here for UI messages
        onFinish: async ({ messages, responseMessage }) => {
          // responseMessage contains just the generated message in UIMessage format
          await onFinish(responseMessage);
        },
        sendReasoning: true,
        headers: corsHeaders,
      });
      return ok(streamResponse);
    } catch (error) {
      console.error(error);
      retryCount++;
      if (retryCount === 3) {
        return err(error as Error);
      }
    }
  }
  return err(new Error("Failed to stream text"));
};

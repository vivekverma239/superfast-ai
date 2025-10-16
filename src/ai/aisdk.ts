import { createGoogleGenerativeAI, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { createOpenAI, openai } from '@ai-sdk/openai';
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
} from 'ai';
import { z } from 'zod';
import { err, ok, Result } from 'neverthrow';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { perplexity } from '@ai-sdk/perplexity';
import { v4 as uuidv4 } from 'uuid';
import { AI_MODEL, OPENROUTER_MODEL, REASONING_MODELS } from './models';
import { createXai } from '@ai-sdk/xai';
import { trackLLMUsage, getProviderFromModel, logUsageSummary } from '../utils/usageAsyncContext';

const xai = createXai({
	apiKey: process.env.XAI_API_KEY,
});
const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Get an AI LLM model
 * @param model - The model to use
 * @returns The LLM model
 */
export const getAILLM = (model: AI_MODEL | OPENROUTER_MODEL): LanguageModel => {
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
					sort: 'throughput',
				},
			},
		});
	}

	if (model === OPENROUTER_MODEL.GPT_OSS_120B) {
		return openrouter(model, {
			extraBody: {
				provider: {
					sort: 'price',
					// only: ['cerebras'],
				},
			},
		});
	}

	if (model === OPENROUTER_MODEL.DEEPSEEK_R1_0528) {
		return openrouter(model, {
			extraBody: {
				provider: {
					sort: 'throughput',
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
					sort: 'throughput',
					only: ['cerebras'],
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

	if (model.includes('gpt-5')) {
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

	if (model === AI_MODEL.XAI_GROK_4_REASONING) {
		return xai(model);
	}

	return google(model);
};

/**
 * Get the provider options for a model
 * @param model - The model to use
 * @param reasoningLevel - The reasoning level to use
 * @returns The provider options
 */
export const getProviderOptions = (model: AI_MODEL | OPENROUTER_MODEL, reasoningLevel: 'none' | 'default' | 'high') => {
	if (!REASONING_MODELS.includes(model)) {
		return undefined;
	}

	return {
		google: {
			thinkingConfig: {
				thinkingBudget: reasoningLevel === 'high' ? 512 : reasoningLevel === 'default' ? 256 : 0,
				includeThoughts: true,
			},
		} satisfies GoogleGenerativeAIProviderOptions,
		openai: {
			reasoningEffort: reasoningLevel === 'high' ? 'high' : reasoningLevel === 'default' ? 'medium' : 'low',
		},
	};
};

/**
 * On step finish
 * @param sessionID - The session ID
 * @param messageID - The message ID
 * @param step - The step
 * @returns The data
 */
const onStepFinish =
	(sessionID?: string, messageID?: string, userID?: string, onStepFinishCallback?: (stepResult: StepResult<ToolSet>) => void) =>
	(step: StepResult<ToolSet>) => {
		// Call the callback if provided
		if (onStepFinishCallback) {
			onStepFinishCallback(step);
		}

		const data = {
			messageID,
			finishReason: step.finishReason,
			reasoning: step.reasoning,
			reasoningDetails: step.reasoning,
			usage: step.usage,
			text: step.text,
			toolCalls: step.toolCalls,
			toolResults: step.toolResults,
			messages: step.response.modelId,
			timestamp: step.response.timestamp,
		};
		console.info({
			type: 'LLM_STEP_FINISH',
			sessionID,
		});
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
	reasoningLevel = 'none',
	tools,
	userID,
	sessionID,
	lastMessageID,
	onStepFinishCallback,
	functionName,
}: {
	model: AI_MODEL | OPENROUTER_MODEL;
	messages: ModelMessage[];
	systemPrompt: string;
	reasoningLevel: 'none' | 'default' | 'high';
	tools?: ToolSet;
	userID?: string;
	sessionID?: string;
	lastMessageID?: string;
	onStepFinishCallback?: (stepResult: StepResult<ToolSet>) => void;
	functionName?: string;
}) => {
	// Check if last message is a assistant message
	if (messages[messages.length - 1].role === 'assistant') {
		messages.push({
			role: 'user',
			content: `<system>No message from user, please send a message in continuation of the conversation and system message.</system>`,
		});
	}

	// Check if system prompt is not attached
	if (messages[0].role !== 'system') {
		messages.unshift({
			role: 'system',
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

			onStepFinish: onStepFinish(sessionID, lastMessageID, userID, onStepFinishCallback),
			//   experimental_telemetry: {
			//     isEnabled: true,
			//     tracer: getTracer(),
			//   },
			stopWhen: stepCountIs(10),
			maxRetries: 3,
		});

		// Track usage for the final response
		if (response.usage) {
			trackLLMUsage({
				usage: response.usage,
				model: model,
				provider: getProviderFromModel(model),
			});
		}

		return ok(response);
	} catch (error) {
		console.error({
			type: 'ERROR',
			message: `Error in generateTextWrapper: ${error as Error}`,
		});
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
	reasoningLevel = 'none',
}: {
	model: AI_MODEL | OPENROUTER_MODEL;
	messages: ModelMessage[];
	schema: z.ZodObject;
	reasoningLevel: 'none' | 'default' | 'high';
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

			// Track usage for the response
			if (response.usage) {
				trackLLMUsage({
					usage: response.usage,
					model: model,
					provider: getProviderFromModel(model),
				});
			}

			return ok(response.object as T);
		} catch (error) {
			console.log(error);
			console.error({
				type: 'ERROR',
				message: `Error in generateObjectWrapper: ${error as Error}`,
			});
			retryCount++;
			if (retryCount === 3) {
				return err(error as Error);
			}
		}
	}
	return err(new Error('Failed to generate object'));
};

export const streamTextWrapper = async ({
	model,
	messages,
	systemPrompt,
	reasoningLevel = 'none',
	tools,
	onFinish,
	requestHeaders,
}: {
	model: AI_MODEL | OPENROUTER_MODEL;
	messages: UIMessage[];
	systemPrompt: string;
	reasoningLevel: 'none' | 'default' | 'high';
	tools?: ToolSet;
	onFinish: (responseMessage: UIMessage) => Promise<void>;
	requestHeaders?: Headers;
}) => {
	const llm = getAILLM(model);
	const providerOptions = getProviderOptions(model, reasoningLevel);

	const modelMessages = convertToModelMessages(messages);
	if (modelMessages[0].role !== 'system') {
		modelMessages.unshift({
			role: 'system',
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

			const origin = requestHeaders?.get('Origin') ?? '*';
			const corsHeaders: Record<string, string> = {
				'Access-Control-Allow-Origin': origin,
				Vary: 'Origin',
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Allow-Credentials': 'true',
			};
			// const combinedHeaders: Record<string, string> = { ...corsHeaders };
			// for (const [k, v] of corsHeaders.entries()) {
			//   const key = String(k);
			//   if (!key.toLowerCase().startsWith("access-control-")) {
			//     combinedHeaders[key] = v as string;
			//   }
			// }

			const streamResponse = response.toUIMessageStreamResponse({
				originalMessages: messages, // Pass original messages for context
				generateMessageId: () => uuidv4().toString(), // ID generation moved here for UI messages
				onFinish: async ({ messages, responseMessage }) => {
					// Track usage for streaming response
					try {
						const usage = await response.usage;
						if (usage) {
							trackLLMUsage({
								usage: usage,
								model: model,
								provider: getProviderFromModel(model),
							});
						}
					} catch (error) {
						console.warn('Failed to get usage from streaming response:', error);
					}
					// responseMessage contains just the generated message in UIMessage format
					await onFinish(responseMessage);
				},
				sendReasoning: true,
				headers: corsHeaders,
			});
			return ok(streamResponse);
		} catch (error) {
			console.error({
				type: 'ERROR',
				message: `Error in streamTextWrapper: ${error as Error}`,
			});
			retryCount++;
			if (retryCount === 3) {
				return err(error as Error);
			}
		}
	}
	return err(new Error('Failed to stream text'));
};

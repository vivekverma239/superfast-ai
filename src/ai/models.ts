export enum AI_MODEL {
	GEMINI_1_5_PRO = 'gemini-1.5-pro',
	// GEMINI_2_0_FLASH = "gemini-2.0-flash",
	GEMINI_2_0_FLASH = 'gemini-2.0-flash',

	// GEMINI_2_5_PRO = "gemini-2.5-pro-preview-03-25",
	GEMINI_2_5_PRO = 'gemini-2.5-pro',

	// GEMINI_2_5_FLASH = "gemini-2.5-flash-preview-04-17",
	GEMINI_2_5_FLASH = 'gemini-2.5-flash',
	GEMINI_2_5_FLASH_LITE = 'gemini-2.5-flash-lite',
	GEMINI_2_5_FLASH_LITE_LATEST = 'gemini-flash-lite-latest',

	GEMINI_2_5_FLASH_SEARCH = 'gemini-2.5-flash-search',

	GPT_4_1 = 'gpt-4.1-2025-04-14',
	GPT_4_1_MINI = 'gpt-4.1-mini-2025-04-14',
	GPT_4_1_NANO = 'gpt-4.1-nano-2025-04-14',
	O4_MINI = 'o4-mini-2025-04-16',
	O3 = 'o3',
	GPT_5_MINI = 'gpt-5-mini-2025-08-07',
	GPT_5 = 'gpt-5-2025-08-07',
	GPT_5_NANO = 'gpt-5-nano-2025-08-07',
	CLAUDE_4_SONNET = 'claude-sonnet-4-20250514',
	PERPLEXITY_SONAR = 'sonar',
	XAI_GROK_4_REASONING = 'grok-4-fast-reasoning',
}
export enum OPENROUTER_MODEL {
	GROK_4 = 'x-ai/grok-4',
	KIMI_K2 = 'moonshotai/kimi-k2',
	CLAUDE_3_7_SONNET = 'anthropic/claude-3.7-sonnet',
	CLAUDE_4_SONNET = 'anthropic/claude-sonnet-4',
	CLAUDE_3_5_SONNET = 'anthropic/claude-3.5-sonnet',
	PERPLEXITY_SONAR = 'perplexity/sonar',
	GLM_4_5 = 'z-ai/glm-4.5',
	QWEN_3_235B_A22B_2507 = 'qwen/qwen3-235b-a22b-2507',
	GPT_OSS_120B = 'openai/gpt-oss-120b',
	DEEPSEEK_R1_0528 = 'deepseek/deepseek-r1-0528',
	GROK_4_FAST = 'x-ai/grok-4-fast:free',
}

export const REASONING_MODELS: (AI_MODEL | OPENROUTER_MODEL)[] = [
	AI_MODEL.GEMINI_2_5_FLASH,
	AI_MODEL.GEMINI_2_5_PRO,
	AI_MODEL.O4_MINI,
	AI_MODEL.CLAUDE_4_SONNET,
	OPENROUTER_MODEL.GROK_4_FAST,
	AI_MODEL.XAI_GROK_4_REASONING,
	AI_MODEL.GEMINI_2_5_FLASH_LITE_LATEST,
];

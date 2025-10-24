import { z } from "zod";
import {
  AgentConfig,
  StatefulAgentConfig,
  AgentConfigSchema,
  StatefulAgentConfigSchema,
} from "./types";
import { AI_MODEL, OPENROUTER_MODEL } from "@/ai/aisdk";

// Configuration validation
export class ConfigValidator {
  static validateAgentConfig(config: unknown): AgentConfig {
    return AgentConfigSchema.parse(config);
  }

  static validateStatefulAgentConfig(config: unknown): StatefulAgentConfig {
    return StatefulAgentConfigSchema.parse(config);
  }

  static validatePartialConfig<T extends Record<string, unknown>>(
    config: unknown,
    schema: z.ZodSchema<T>
  ): Partial<T> {
    return schema.parse(config);
  }
}

// Configuration builder pattern
export class AgentConfigBuilder {
  private config: Partial<AgentConfig> = {};

  static create(): AgentConfigBuilder {
    return new AgentConfigBuilder();
  }

  model(model: AI_MODEL | OPENROUTER_MODEL): this {
    this.config.model = model;
    return this;
  }

  maxSteps(steps: number): this {
    this.config.maxSteps = steps;
    return this;
  }

  temperature(temp: number): this {
    this.config.temperature = temp;
    return this;
  }

  maxTokens(tokens: number): this {
    this.config.maxTokens = tokens;
    return this;
  }

  retries(count: number): this {
    this.config.retries = count;
    return this;
  }

  build(): AgentConfig {
    if (!this.config.model) {
      throw new Error("Model is required");
    }
    if (!this.config.maxSteps) {
      this.config.maxSteps = 10; // default
    }

    return ConfigValidator.validateAgentConfig(this.config);
  }
}

export class StatefulAgentConfigBuilder extends AgentConfigBuilder {
  private statefulConfig: Partial<StatefulAgentConfig> = {};

  includeMemory(include: boolean = true): this {
    this.statefulConfig.includeMemory = include;
    return this;
  }

  includeTodoList(include: boolean = true): this {
    this.statefulConfig.includeTodoList = include;
    return this;
  }

  includeWebTools(include: boolean = true): this {
    this.statefulConfig.includeWebTools = include;
    return this;
  }

  includeArtifacts(include: boolean = true): this {
    this.statefulConfig.includeArtifacts = include;
    return this;
  }

  override build(): StatefulAgentConfig {
    const baseConfig = super.build();
    return ConfigValidator.validateStatefulAgentConfig({
      ...baseConfig,
      ...this.statefulConfig,
    });
  }
}

// Configuration presets
export class ConfigPresets {
  static readonly RESEARCHER: StatefulAgentConfig = {
    model: OPENROUTER_MODEL.GROK_4_FAST,
    maxSteps: 10,
    temperature: 0.7,
    includeMemory: true,
    includeTodoList: true,
    includeWebTools: true,
    includeArtifacts: true,
    retries: 3,
  };

  static readonly SIMPLE_CHAT: AgentConfig = {
    model: AI_MODEL.GEMINI_2_5_FLASH,
    maxSteps: 1,
    temperature: 0.5,
    retries: 1,
  };

  static readonly PDF_ANALYZER: AgentConfig = {
    model: OPENROUTER_MODEL.GROK_4_FAST,
    maxSteps: 5,
    temperature: 0.3,
    retries: 2,
  };

  static readonly FAST_RESPONDER: AgentConfig = {
    model: AI_MODEL.GEMINI_2_5_FLASH_LITE,
    maxSteps: 1,
    temperature: 0.4,
    maxTokens: 1000,
    retries: 1,
  };
}

// Environment-based configuration
export class EnvironmentConfig {
  private static readonly ENV_PREFIX = "AGENT_";

  static loadFromEnv(): Partial<AgentConfig> {
    const config: Partial<AgentConfig> = {};

    if (process.env[`${this.ENV_PREFIX}MODEL`]) {
      const model = process.env[`${this.ENV_PREFIX}MODEL`]!;
      if (Object.values(AI_MODEL).includes(model as AI_MODEL)) {
        config.model = model as AI_MODEL;
      } else if (
        Object.values(OPENROUTER_MODEL).includes(model as OPENROUTER_MODEL)
      ) {
        config.model = model as OPENROUTER_MODEL;
      }
    }

    if (process.env[`${this.ENV_PREFIX}MAX_STEPS`]) {
      config.maxSteps = parseInt(process.env[`${this.ENV_PREFIX}MAX_STEPS`]!);
    }

    if (process.env[`${this.ENV_PREFIX}TEMPERATURE`]) {
      config.temperature = parseFloat(
        process.env[`${this.ENV_PREFIX}TEMPERATURE`]!
      );
    }

    if (process.env[`${this.ENV_PREFIX}MAX_TOKENS`]) {
      config.maxTokens = parseInt(process.env[`${this.ENV_PREFIX}MAX_TOKENS`]!);
    }

    if (process.env[`${this.ENV_PREFIX}RETRIES`]) {
      config.retries = parseInt(process.env[`${this.ENV_PREFIX}RETRIES`]!);
    }

    return config;
  }

  static loadStatefulFromEnv(): Partial<StatefulAgentConfig> {
    const baseConfig = this.loadFromEnv();
    const statefulConfig: Partial<StatefulAgentConfig> = { ...baseConfig };

    if (process.env[`${this.ENV_PREFIX}INCLUDE_MEMORY`]) {
      statefulConfig.includeMemory =
        process.env[`${this.ENV_PREFIX}INCLUDE_MEMORY`] === "true";
    }

    if (process.env[`${this.ENV_PREFIX}INCLUDE_TODO_LIST`]) {
      statefulConfig.includeTodoList =
        process.env[`${this.ENV_PREFIX}INCLUDE_TODO_LIST`] === "true";
    }

    if (process.env[`${this.ENV_PREFIX}INCLUDE_WEB_TOOLS`]) {
      statefulConfig.includeWebTools =
        process.env[`${this.ENV_PREFIX}INCLUDE_WEB_TOOLS`] === "true";
    }

    if (process.env[`${this.ENV_PREFIX}INCLUDE_ARTIFACTS`]) {
      statefulConfig.includeArtifacts =
        process.env[`${this.ENV_PREFIX}INCLUDE_ARTIFACTS`] === "true";
    }

    return statefulConfig;
  }
}

// Configuration manager
export class ConfigManager {
  private configs = new Map<string, AgentConfig | StatefulAgentConfig>();

  register(name: string, config: AgentConfig | StatefulAgentConfig): void {
    this.configs.set(name, config);
  }

  get(name: string): AgentConfig | StatefulAgentConfig | undefined {
    return this.configs.get(name);
  }

  getOrCreate(
    name: string,
    factory: () => AgentConfig | StatefulAgentConfig
  ): AgentConfig | StatefulAgentConfig {
    if (!this.configs.has(name)) {
      this.configs.set(name, factory());
    }
    return this.configs.get(name)!;
  }

  merge(base: AgentConfig, overrides: Partial<AgentConfig>): AgentConfig {
    return { ...base, ...overrides };
  }

  mergeStateful(
    base: StatefulAgentConfig,
    overrides: Partial<StatefulAgentConfig>
  ): StatefulAgentConfig {
    return { ...base, ...overrides };
  }

  validate(config: unknown): AgentConfig {
    return ConfigValidator.validateAgentConfig(config);
  }

  validateStateful(config: unknown): StatefulAgentConfig {
    return ConfigValidator.validateStatefulAgentConfig(config);
  }

  list(): string[] {
    return Array.from(this.configs.keys());
  }

  clear(): void {
    this.configs.clear();
  }
}

// Global configuration instance
export const globalConfigManager = new ConfigManager();

// Initialize with presets
globalConfigManager.register("researcher", ConfigPresets.RESEARCHER);
globalConfigManager.register("simple-chat", ConfigPresets.SIMPLE_CHAT);
globalConfigManager.register("pdf-analyzer", ConfigPresets.PDF_ANALYZER);
globalConfigManager.register("fast-responder", ConfigPresets.FAST_RESPONDER);

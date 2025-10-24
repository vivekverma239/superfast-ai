import { Database } from "@/db";
import { AI_MODEL, OPENROUTER_MODEL } from "../aisdk";
import {
  convertToModelMessages,
  generateText,
  ModelMessage,
  streamText,
  ToolSet,
  UIMessage,
} from "ai";
import { Storage } from "@/storage";
import { VectorStore } from "@/vector-store";
import { BaseAgentContext, AgentConfig } from "./core";

export type BaseContext = {
  db: Database;
  storage: Storage;
  vectorStore: VectorStore;
};

export class BaseAgent<T extends BaseContext> {
  name: string;
  model: AI_MODEL | OPENROUTER_MODEL;
  tools: ToolSet | undefined | ((context: T) => ToolSet);
  instructions: string | undefined | ((context: T) => string);

  constructor({
    name,
    model,
    tools,
    instructions,
  }: {
    name: string;
    model: AI_MODEL | OPENROUTER_MODEL;
    tools: ToolSet | undefined | ((context: T) => ToolSet);
    instructions: string | undefined | ((context: T) => string);
  }) {
    this.name = name;
    this.model = model;
    this.tools = tools;
    this.instructions = instructions;
  }

  async generate(messages: ModelMessage[] | string, context: T) {
    const modelMessages: ModelMessage[] =
      typeof messages === "string"
        ? [{ role: "user", content: messages }]
        : messages;
    if (this.instructions) {
      modelMessages.unshift({
        role: "system",
        content:
          typeof this.instructions === "function"
            ? this.instructions(context)
            : this.instructions,
      });
    }
    const tools =
      typeof this.tools === "function" ? this.tools(context) : this.tools;
    const result = await generateText({
      model: this.model,
      messages: modelMessages,
      tools: tools,
    });
    return result;
  }

  async stream(messages: ModelMessage[] | string, context: T) {
    const modelMessages: ModelMessage[] =
      typeof messages === "string"
        ? [{ role: "user", content: messages }]
        : messages;
    if (this.instructions) {
      modelMessages.unshift({
        role: "system",
        content:
          typeof this.instructions === "function"
            ? this.instructions(context)
            : this.instructions,
      });
    }
    const tools =
      typeof this.tools === "function" ? this.tools(context) : this.tools;
    const result = await streamText({
      model: this.model,
      messages: modelMessages,
      tools: tools,
    });
    return result.toUIMessageStreamResponse();
  }
}

// New BaseAgent that extends the core system
export class NewBaseAgent<T extends BaseAgentContext> {
  name: string;
  config: AgentConfig;
  context: T;

  constructor(name: string, config: AgentConfig, context: T) {
    this.name = name;
    this.config = config;
    this.context = context;
  }

  async generate(messages: ModelMessage[] | string) {
    const modelMessages: ModelMessage[] =
      typeof messages === "string"
        ? [{ role: "user", content: messages }]
        : messages;

    const result = await generateText({
      model: this.config.model,
      messages: modelMessages,
      maxRetries: this.config.retries || 3,
    });
    return result;
  }

  async stream(messages: ModelMessage[] | string) {
    const modelMessages: ModelMessage[] =
      typeof messages === "string"
        ? [{ role: "user", content: messages }]
        : messages;

    const result = await streamText({
      model: this.config.model,
      messages: modelMessages,
      maxRetries: this.config.retries || 3,
    });
    return result.toUIMessageStreamResponse();
  }
}

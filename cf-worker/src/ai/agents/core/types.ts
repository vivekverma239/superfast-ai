import { z } from "zod";
import { UIMessage, Tool, ToolSet } from "ai";
import { AI_MODEL, OPENROUTER_MODEL } from "@/ai/aisdk";
import { Database } from "@/db";
import { Storage } from "@/storage";
import { VectorStore } from "@/vector-store";
import { KnowledgeBaseProvider } from "./knowledge-provider";
import { MessageStateManager, MemoryStateManager } from "./state-managers";
import { TodoStateManager } from "./state-managers";
import { ArtifactStateManager } from "./state-managers";

// Core context that all agents need
export interface BaseAgentContext {
  db: Database;
  storage: Storage;
  vectorStore: VectorStore;
  userId: string;
  knowledgeBase?: KnowledgeBaseProvider;
  memoryManager?: MemoryStateManager;
  todoManager?: TodoStateManager;
  artifactManager?: ArtifactStateManager;
  messageManager?: MessageStateManager;
}

// Extended context for agents that work with threads
export interface ThreadAgentContext extends BaseAgentContext {
  threadId: string;
  folderId?: string;
}

// State management interfaces
export interface StateManager<T> {
  load(): Promise<T>;
  save(state: T): Promise<void>;
  update(updater: (state: T) => T): Promise<void>;
  clear(): Promise<void>;
}

// Provider pattern interfaces
export interface Provider<T, C> {
  load(context: C): Promise<T>;
  save(context: C, data: T): Promise<void>;
  delete(context: C, id: string): Promise<void>;
}

// Tool registry interfaces
export interface ToolRegistry {
  register(name: string, tool: Tool): void;
  unregister(name: string): void;
  getTools(filter?: ToolFilter): ToolSet;
  hasTool(name: string): boolean;
}

export interface ToolFilter {
  categories?: string[];
  required?: string[];
  exclude?: string[];
}

// Configuration management
export interface AgentConfig {
  model: AI_MODEL | OPENROUTER_MODEL;
  maxSteps: number;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
}

export interface StatefulAgentConfig extends AgentConfig {
  includeMemory: boolean;
  includeTodoList: boolean;
  includeWebTools: boolean;
  includeArtifacts: boolean;
}

// Message handling
export interface MessageHandler<T extends BaseAgentContext> {
  loadMessages(context: T): Promise<UIMessage[]>;
  saveMessage(context: T, message: UIMessage): Promise<void>;
  clearMessages(context: T): Promise<void>;
}

// Error handling
export interface AgentError extends Error {
  code: string;
  context?: Record<string, unknown>;
  retryable: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// Plugin system
export interface AgentPlugin<T extends BaseAgentContext> {
  name: string;
  version: string;
  dependencies?: string[];
  install(agent: Agent<T>): Promise<void>;
  uninstall(agent: Agent<T>): Promise<void>;
}

// Core agent interface
export interface Agent<T extends BaseAgentContext> {
  name: string;
  config: AgentConfig;
  context: T;

  run(message: UIMessage): Promise<UIMessage>;
  stream(message: UIMessage): Promise<Response>;

  addPlugin(plugin: AgentPlugin<T>): Promise<void>;
  removePlugin(name: string): Promise<void>;

  getTools(): ToolSet;
  getState(): Promise<unknown>;
}

// State interfaces for different agent types
export interface MemoryState {
  id: string;
  details: string;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
}

export interface TodoState {
  id: string;
  task: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: Date;
  updatedAt?: Date;
  priority?: "low" | "medium" | "high";
}

export interface ArtifactState {
  id: string;
  title: string;
  type: string;
  content: unknown;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
}

// Validation schemas
export const AgentConfigSchema = z.object({
  model: z.union([z.nativeEnum(AI_MODEL), z.nativeEnum(OPENROUTER_MODEL)]),
  maxSteps: z.number().min(1).max(50),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  retries: z.number().min(0).max(5).optional(),
});

export const StatefulAgentConfigSchema = AgentConfigSchema.extend({
  includeMemory: z.boolean(),
  includeTodoList: z.boolean(),
  includeWebTools: z.boolean(),
  includeArtifacts: z.boolean(),
});

export const MemoryStateSchema = z.object({
  id: z.string(),
  details: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
});

export const TodoStateSchema = z.object({
  id: z.string(),
  task: z.string(),
  status: z.enum(["pending", "in_progress", "completed"]),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const ArtifactStateSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  content: z.unknown(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

import {
  UIMessage,
  Tool,
  convertToModelMessages,
  generateText,
  streamText,
  stepCountIs,
} from "ai";
import { nanoid } from "nanoid";
import {
  Agent,
  BaseAgentContext,
  AgentConfig,
  AgentPlugin,
  StateManager,
  MemoryState,
  TodoState,
  ArtifactState,
  StatefulAgentConfig,
} from "./types";
import { FactoryToolRegistry, ToolFactory } from "./tool-registry";
import { ErrorHandler, RetryManager, CircuitBreaker } from "./error-handling";
import { getAILLM } from "@/ai/aisdk";

// Abstract base agent implementation
export abstract class BaseAgentImpl<T extends BaseAgentContext>
  implements Agent<T>
{
  public readonly name: string;
  public readonly config: AgentConfig;
  public readonly context: T;

  protected toolRegistry: FactoryToolRegistry<T>;
  protected circuitBreaker: CircuitBreaker;
  protected plugins = new Map<string, AgentPlugin<T>>();

  constructor(
    name: string,
    config: AgentConfig,
    context: T,
    toolRegistry?: FactoryToolRegistry<T>
  ) {
    this.name = name;
    this.config = config;
    this.context = context;
    this.toolRegistry = toolRegistry || new FactoryToolRegistry<T>();
    this.circuitBreaker = new CircuitBreaker();

    this.toolRegistry.setContext(context);
    this.initializeTools();
  }

  // Abstract methods to be implemented by subclasses
  protected abstract initializeTools(): void;
  protected abstract buildSystemPrompt(): string;

  // Core agent methods
  async run(message: UIMessage): Promise<UIMessage> {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await RetryManager.executeWithRetry(
          () => this.executeRun(message),
          { maxRetries: this.config.retries || 3 },
          `${this.name}.run`
        );
      });
    } catch (error) {
      const agentError = ErrorHandler.handle(error, `${this.name}.run`);
      throw agentError;
    }
  }

  async stream(message: UIMessage): Promise<Response> {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await RetryManager.executeWithRetry(
          () => this.executeStream(message),
          { maxRetries: this.config.retries || 3 },
          `${this.name}.stream`
        );
      });
    } catch (error) {
      const agentError = ErrorHandler.handle(error, `${this.name}.stream`);
      throw agentError;
    }
  }

  private async executeRun(message: UIMessage): Promise<UIMessage> {
    const messages = await this.loadMessages();
    const modelMessages = convertToModelMessages([...messages, message]);

    const result = await generateText({
      model: this.config.model,
      system: this.buildSystemPrompt(),
      messages: modelMessages,
      tools: this.getTools(),
      maxRetries: this.config.retries || 3,
    });

    const responseMessage: UIMessage = {
      id: nanoid(),
      role: "assistant",
      parts: [
        {
          type: "text",
          text: result.text,
        },
      ],
    };

    await this.saveMessage(responseMessage);
    return responseMessage;
  }

  private async executeStream(message: UIMessage): Promise<Response> {
    const messages = await this.loadMessages();
    const modelMessages = convertToModelMessages([...messages, message]);
    // Save the incoming message
    await this.saveMessage(message);

    console.log("modelMessages", modelMessages);
    const llm = getAILLM(this.config.model);
    const result = await streamText({
      model: llm,
      system: this.buildSystemPrompt(),
      messages: modelMessages,
      tools: this.getTools(),
      maxRetries: this.config.retries || 3,
      stopWhen: stepCountIs(this.config.maxSteps || 50),
    });

    return result.toUIMessageStreamResponse({
      generateMessageId: () => nanoid().toString(),
      onFinish: async ({ responseMessage }: { responseMessage: UIMessage }) => {
        responseMessage.id = nanoid().toString();
        await this.saveMessage(responseMessage);
      },
    });
  }

  // Tool management
  getTools() {
    return this.toolRegistry.getTools();
  }

  registerTool(name: string, tool: Tool): void {
    this.toolRegistry.register(name, tool);
  }

  registerToolFactory(factory: ToolFactory<T>): void {
    this.toolRegistry.registerFactory(factory);
  }

  unregisterTool(name: string): void {
    this.toolRegistry.unregister(name);
  }

  // Plugin management
  async addPlugin(plugin: AgentPlugin<T>): Promise<void> {
    try {
      await plugin.install(this);
      this.plugins.set(plugin.name, plugin);
    } catch (error) {
      throw new Error(`Failed to install plugin ${plugin.name}: ${error}`);
    }
  }

  async removePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
      try {
        await plugin.uninstall(this);
        this.plugins.delete(name);
      } catch (error) {
        throw new Error(`Failed to uninstall plugin ${name}: ${error}`);
      }
    }
  }

  // State management
  async getState(): Promise<unknown> {
    // Override in subclasses to return specific state
    return {};
  }

  // Message handling - to be implemented by subclasses if needed
  protected async loadMessages(): Promise<UIMessage[]> {
    return [];
  }

  protected async saveMessage(_message: UIMessage): Promise<void> {
    // Override in subclasses if message persistence is needed
  }

  // Utility methods
  protected createToolFactory(
    name: string,
    createFn: (context: T) => Tool,
    dependencies?: string[]
  ): ToolFactory<T> {
    return {
      name,
      create: createFn,
      dependencies,
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    details: Record<string, unknown>;
  }> {
    const circuitBreakerState = this.circuitBreaker.getState();
    const toolCount = this.toolRegistry.listTools().length;
    const pluginCount = this.plugins.size;

    return {
      status: circuitBreakerState.state === "OPEN" ? "unhealthy" : "healthy",
      details: {
        circuitBreaker: circuitBreakerState,
        tools: toolCount,
        plugins: pluginCount,
        config: this.config,
      },
    };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Uninstall all plugins
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.uninstall(this);
      } catch (error) {
        console.warn(`Failed to uninstall plugin ${name}:`, error);
      }
    }
    this.plugins.clear();

    // Clear tool registry
    this.toolRegistry.clear();
  }
}

// Stateful agent base class
export abstract class StatefulAgentImpl<
  T extends BaseAgentContext,
> extends BaseAgentImpl<T> {
  protected memoryManager?: StateManager<MemoryState[]>;
  protected todoManager?: StateManager<TodoState[]>;
  protected artifactManager?: StateManager<ArtifactState[]>;

  constructor(
    name: string,
    config: StatefulAgentConfig,
    context: T,
    toolRegistry?: FactoryToolRegistry<T>
  ) {
    super(name, config, context, toolRegistry);
  }

  protected initializeStateManagers(): void {
    // Override in subclasses to initialize specific state managers
  }
}

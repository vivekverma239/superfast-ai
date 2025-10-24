import { Tool, ToolSet } from "ai";
import { ToolRegistry, ToolFilter, BaseAgentContext } from "./types";

export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<string, Tool>();

  register(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getTools(filter?: ToolFilter): ToolSet {
    let filteredTools = Array.from(this.tools.entries());

    if (filter) {
      if (filter.required) {
        const missing = filter.required.filter((name) => !this.tools.has(name));
        if (missing.length > 0) {
          throw new Error(`Required tools not found: ${missing.join(", ")}`);
        }
        filteredTools = filteredTools.filter(([name]) =>
          filter.required!.includes(name)
        );
      }

      if (filter.exclude) {
        filteredTools = filteredTools.filter(
          ([name]) => !filter.exclude!.includes(name)
        );
      }

      if (filter.categories) {
        // This would require tools to have category metadata
        // For now, we'll skip category filtering
      }
    }

    return Object.fromEntries(filteredTools);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  clear(): void {
    this.tools.clear();
  }
}

// Tool factory interface
export interface ToolFactory<T extends BaseAgentContext> {
  name: string;
  create(context: T): Tool;
  dependencies?: string[];
}

// Tool registry with factory support
export class FactoryToolRegistry<T extends BaseAgentContext>
  implements ToolRegistry
{
  private tools = new Map<string, Tool>();
  private factories = new Map<string, ToolFactory<T>>();
  private context: T | null = null;

  setContext(context: T): void {
    this.context = context;
  }

  registerFactory(factory: ToolFactory<T>): void {
    this.factories.set(factory.name, factory);
  }

  unregisterFactory(name: string): void {
    this.factories.delete(name);
  }

  register(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getTools(filter?: ToolFilter): ToolSet {
    if (!this.context) {
      throw new Error("Context not set. Call setContext() first.");
    }

    // Create tools from factories
    for (const [name, factory] of this.factories) {
      if (!this.tools.has(name)) {
        try {
          const tool = factory.create(this.context);
          this.tools.set(name, tool);
        } catch (error) {
          console.warn(`Failed to create tool ${name}:`, error);
        }
      }
    }

    // Apply filters
    let filteredTools = Array.from(this.tools.entries());

    if (filter) {
      if (filter.required) {
        const missing = filter.required.filter((name) => !this.tools.has(name));
        if (missing.length > 0) {
          throw new Error(`Required tools not found: ${missing.join(", ")}`);
        }
        filteredTools = filteredTools.filter(([name]) =>
          filter.required!.includes(name)
        );
      }

      if (filter.exclude) {
        filteredTools = filteredTools.filter(
          ([name]) => !filter.exclude!.includes(name)
        );
      }
    }

    return Object.fromEntries(filteredTools);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name) || this.factories.has(name);
  }

  getTool(name: string): Tool | undefined {
    if (this.tools.has(name)) {
      return this.tools.get(name);
    }

    if (this.factories.has(name) && this.context) {
      const factory = this.factories.get(name)!;
      const tool = factory.create(this.context);
      this.tools.set(name, tool);
      return tool;
    }

    return undefined;
  }

  listTools(): string[] {
    return Array.from(
      new Set([...this.tools.keys(), ...this.factories.keys()])
    );
  }

  clear(): void {
    this.tools.clear();
    this.factories.clear();
  }
}

// Tool categories for better organization
export enum ToolCategory {
  MEMORY = "memory",
  TODO = "todo",
  ARTIFACT = "artifact",
  WEB = "web",
  KNOWLEDGE = "knowledge",
  FILE = "file",
  UTILITY = "utility",
}

// Tool metadata interface
export interface ToolMetadata {
  name: string;
  category: ToolCategory;
  description: string;
  dependencies?: string[];
  requiredContext?: string[];
}

// Enhanced tool registry with metadata
export class MetadataToolRegistry<
  T extends BaseAgentContext,
> extends FactoryToolRegistry<T> {
  private metadata = new Map<string, ToolMetadata>();

  registerWithMetadata(metadata: ToolMetadata, factory: ToolFactory<T>): void {
    this.metadata.set(metadata.name, metadata);
    this.registerFactory(factory);
  }

  getToolsByCategory(category: ToolCategory): ToolSet {
    const toolsInCategory = Array.from(this.metadata.entries())
      .filter(([, meta]) => meta.category === category)
      .map(([name]) => name);

    return this.getTools({ required: toolsInCategory });
  }

  getToolMetadata(name: string): ToolMetadata | undefined {
    return this.metadata.get(name);
  }

  getToolsByFilter(filter: ToolFilter): ToolSet {
    let filteredTools = Array.from(this.metadata.entries());

    if (filter.categories) {
      filteredTools = filteredTools.filter(([, meta]) =>
        filter.categories!.includes(meta.category)
      );
    }

    const toolNames = filteredTools.map(([name]) => name);
    return this.getTools({ required: toolNames });
  }
}

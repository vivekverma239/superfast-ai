import { Database } from "@/db";
import { Storage } from "@/storage";
import { VectorStore } from "@/vector-store";
import { BaseAgentContext, ThreadAgentContext } from "./types";
import {
  MemoryStateManager,
  TodoStateManager,
  ArtifactStateManager,
  MessageStateManager,
} from "./state-managers";
import {
  KnowledgeBaseProviderFactory,
  KnowledgeBaseProvider,
} from "./knowledge-provider";

// Dependency injection container for agent dependencies
export class DependencyContainer {
  private dependencies = new Map<string, unknown>();

  // Register dependencies
  register<T>(key: string, dependency: T): void {
    this.dependencies.set(key, dependency);
  }

  // Get dependency
  get<T>(key: string): T {
    const dependency = this.dependencies.get(key);
    if (!dependency) {
      throw new Error(`Dependency ${key} not found`);
    }
    return dependency as T;
  }

  // Check if dependency exists
  has(key: string): boolean {
    return this.dependencies.has(key);
  }

  // Clear all dependencies
  clear(): void {
    this.dependencies.clear();
  }
}

// Factory for creating agent contexts with all dependencies
export class AgentContextFactory {
  // Create base context with minimal dependencies
  static createBaseContext(
    db: Database,
    storage: Storage,
    vectorStore: VectorStore,
    userId: string
  ): BaseAgentContext {
    return {
      db,
      storage,
      vectorStore,
      userId,
    };
  }

  // Create thread context with all stateful dependencies
  static createThreadContext(
    db: Database,
    storage: Storage,
    vectorStore: VectorStore,
    userId: string,
    threadId: string,
    folderId?: string,
    options: {
      useKnowledgeBase?: boolean;
      useMemoryManager?: boolean;
      useTodoManager?: boolean;
      useArtifactManager?: boolean;
      useMessageManager?: boolean;
    } = {}
  ): ThreadAgentContext {
    const {
      useKnowledgeBase = true,
      useMemoryManager = true,
      useTodoManager = true,
      useArtifactManager = true,
      useMessageManager = true,
    } = options;

    const baseContext = this.createBaseContext(
      db,
      storage,
      vectorStore,
      userId
    );

    const context: ThreadAgentContext = {
      ...baseContext,
      threadId,
      folderId,
    };

    // Inject knowledge base provider
    if (useKnowledgeBase) {
      context.knowledgeBase = KnowledgeBaseProviderFactory.create(baseContext);
    }

    // Inject state managers
    if (useMemoryManager) {
      context.memoryManager = new MemoryStateManager(db, userId);
    }

    if (useTodoManager) {
      context.todoManager = new TodoStateManager(db, userId, threadId);
    }

    if (useArtifactManager) {
      context.artifactManager = new ArtifactStateManager(db, userId, threadId);
    }

    if (useMessageManager) {
      context.messageManager = new MessageStateManager(db, userId, threadId);
    }

    return context;
  }

  // Create context for testing with mock dependencies
  static createTestContext(
    db: Database,
    storage: Storage,
    vectorStore: VectorStore,
    userId: string,
    threadId: string,
    folderId?: string
  ): ThreadAgentContext {
    return this.createThreadContext(
      db,
      storage,
      vectorStore,
      userId,
      threadId,
      folderId,
      {
        useKnowledgeBase: true, // Use mock knowledge base
        useMemoryManager: true,
        useTodoManager: true,
        useArtifactManager: true,
      }
    );
  }

  // Create context with custom dependencies
  static createCustomContext(
    baseContext: BaseAgentContext,
    threadId: string,
    folderId?: string,
    customDependencies: {
      knowledgeBase?: KnowledgeBaseProvider;
      memoryManager?: MemoryStateManager;
      todoManager?: TodoStateManager;
      artifactManager?: ArtifactStateManager;
    } = {}
  ): ThreadAgentContext {
    const context: ThreadAgentContext = {
      ...baseContext,
      threadId,
      folderId,
    };

    // Inject custom dependencies
    if (customDependencies.knowledgeBase) {
      context.knowledgeBase = customDependencies.knowledgeBase;
    }

    if (customDependencies.memoryManager) {
      context.memoryManager = customDependencies.memoryManager;
    }

    if (customDependencies.todoManager) {
      context.todoManager = customDependencies.todoManager;
    }

    if (customDependencies.artifactManager) {
      context.artifactManager = customDependencies.artifactManager;
    }

    return context;
  }
}

// Builder pattern for more complex context creation
export class AgentContextBuilder {
  private db?: Database;
  private storage?: Storage;
  private vectorStore?: VectorStore;
  private userId?: string;
  private threadId?: string;
  private folderId?: string;
  private options: {
    useKnowledgeBase?: boolean;
    useMemoryManager?: boolean;
    useTodoManager?: boolean;
    useArtifactManager?: boolean;
  } = {};

  withDatabase(db: Database): this {
    this.db = db;
    return this;
  }

  withStorage(storage: Storage): this {
    this.storage = storage;
    return this;
  }

  withVectorStore(vectorStore: VectorStore): this {
    this.vectorStore = vectorStore;
    return this;
  }

  withUser(userId: string): this {
    this.userId = userId;
    return this;
  }

  withThread(threadId: string, folderId?: string): this {
    this.threadId = threadId;
    this.folderId = folderId;
    return this;
  }

  withKnowledgeBase(): this {
    this.options.useKnowledgeBase = true;
    return this;
  }

  withStateManagers(
    includeMemory: boolean = true,
    includeTodo: boolean = true,
    includeArtifact: boolean = true
  ): this {
    this.options.useMemoryManager = includeMemory;
    this.options.useTodoManager = includeTodo;
    this.options.useArtifactManager = includeArtifact;
    return this;
  }

  build(): ThreadAgentContext {
    if (
      !this.db ||
      !this.storage ||
      !this.vectorStore ||
      !this.userId ||
      !this.threadId
    ) {
      throw new Error(
        "Missing required dependencies: db, storage, vectorStore, userId, threadId"
      );
    }

    return AgentContextFactory.createThreadContext(
      this.db,
      this.storage,
      this.vectorStore,
      this.userId,
      this.threadId,
      this.folderId,
      this.options
    );
  }
}

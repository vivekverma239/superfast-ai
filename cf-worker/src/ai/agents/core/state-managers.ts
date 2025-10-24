import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { memory, artifact as artifactTable } from "@/db/schema";
import { Database } from "@/db";
import { StateManager, MemoryState, TodoState, ArtifactState } from "./types";
import { UIMessage } from "ai";
import { message } from "@/db/schema";

// Memory State Manager
export class MemoryStateManager implements StateManager<MemoryState[]> {
  constructor(
    private db: Database,
    private userId: string
  ) {}

  async load(): Promise<MemoryState[]> {
    const memoryItem = await this.db.query.memory.findFirst({
      where: eq(memory.userId, this.userId),
    });
    return memoryItem?.memory || [];
  }

  async save(memories: MemoryState[]): Promise<void> {
    await this.db
      .insert(memory)
      .values({
        userId: this.userId,
        memory: memories,
      })
      .onConflictDoUpdate({
        target: [memory.userId],
        set: {
          memory: memories,
        },
      });
  }

  async update(
    updater: (state: MemoryState[]) => MemoryState[]
  ): Promise<void> {
    const current = await this.load();
    const updated = updater(current);
    await this.save(updated);
  }

  async clear(): Promise<void> {
    await this.db.delete(memory).where(eq(memory.userId, this.userId));
  }

  async addMemory(details: string, tags?: string[]): Promise<MemoryState> {
    const newMemory: MemoryState = {
      id: nanoid(),
      details,
      createdAt: new Date(),
      tags,
    };

    await this.update((memories) => [...memories, newMemory]);
    return newMemory;
  }

  async updateMemory(id: string, details: string): Promise<void> {
    await this.update((memories) =>
      memories.map((m) =>
        m.id === id ? { ...m, details, updatedAt: new Date() } : m
      )
    );
  }

  async deleteMemory(id: string): Promise<void> {
    await this.update((memories) => memories.filter((m) => m.id !== id));
  }
}

// Todo State Manager - Simplified in-memory implementation
export class TodoStateManager implements StateManager<TodoState[]> {
  private todos: TodoState[] = [];

  constructor(
    private _db: Database,
    private _userId: string,
    private _threadId: string
  ) {}

  async load(): Promise<TodoState[]> {
    return this.todos;
  }

  async save(todos: TodoState[]): Promise<void> {
    this.todos = todos;
  }

  async update(updater: (state: TodoState[]) => TodoState[]): Promise<void> {
    const current = await this.load();
    const updated = updater(current);
    await this.save(updated);
  }

  async clear(): Promise<void> {
    await this.update(() => []);
  }

  async addTodo(
    task: string,
    priority: "low" | "medium" | "high" = "medium"
  ): Promise<TodoState> {
    const newTodo: TodoState = {
      id: nanoid(),
      task,
      status: "pending",
      createdAt: new Date(),
      priority,
    };

    await this.update((todos) => [...todos, newTodo]);
    return newTodo;
  }

  async updateTodo(
    id: string,
    updates: Partial<Pick<TodoState, "task" | "status" | "priority">>
  ): Promise<void> {
    await this.update((todos) =>
      todos.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
      )
    );
  }

  async deleteTodo(id: string): Promise<void> {
    await this.update((todos) => todos.filter((t) => t.id !== id));
  }
}

// Artifact State Manager
export class ArtifactStateManager implements StateManager<ArtifactState[]> {
  constructor(
    private db: Database,
    private userId: string,
    private threadId: string
  ) {}

  async load(): Promise<ArtifactState[]> {
    const artifacts = await this.db.query.artifact.findMany({
      where: and(
        eq(artifactTable.userId, this.userId),
        eq(artifactTable.threadId, this.threadId)
      ),
    });

    return artifacts.map((a) => ({
      id: a.id,
      title: a.artifact.title,
      type: "research_report",
      content: a.artifact,
      createdAt: new Date(),
      updatedAt: undefined,
    }));
  }

  async save(_artifacts: ArtifactState[]): Promise<void> {
    // Artifacts are saved individually, so this is a no-op
    // Individual artifacts are saved via create/update methods
  }

  async update(
    _updater: (state: ArtifactState[]) => ArtifactState[]
  ): Promise<void> {
    // Individual updates are handled by specific methods
    // This is a no-op for now
  }

  async clear(): Promise<void> {
    await this.db
      .delete(artifactTable)
      .where(
        and(
          eq(artifactTable.userId, this.userId),
          eq(artifactTable.threadId, this.threadId)
        )
      );
  }

  async createArtifact(
    title: string,
    content: unknown,
    type: string = "research_report"
  ): Promise<ArtifactState> {
    const artifactId = nanoid();
    const artifact: ArtifactState = {
      id: artifactId,
      title,
      type,
      content,
      createdAt: new Date(),
    };

    await this.db.insert(artifactTable).values({
      id: artifactId,
      userId: this.userId,
      threadId: this.threadId,
      artifact: content as {
        title: string;
        sections: {
          slug: string;
          title: string;
          content: string;
          references: { id: string; title: string; url?: string }[];
        }[];
      },
    });

    return artifact;
  }

  async updateArtifact(
    id: string,
    updates: Partial<Pick<ArtifactState, "title" | "content">>
  ): Promise<void> {
    const artifact = await this.db.query.artifact.findFirst({
      where: and(
        eq(artifactTable.id, id),
        eq(artifactTable.userId, this.userId),
        eq(artifactTable.threadId, this.threadId)
      ),
    });

    if (!artifact) {
      throw new Error("Artifact not found");
    }

    const updatedContent = Object.assign(
      {},
      artifact.artifact,
      updates.title && { title: updates.title },
      updates.content && updates.content
    );

    await this.db
      .update(artifactTable)
      .set({
        artifact: updatedContent,
      })
      .where(eq(artifactTable.id, id));
  }

  async deleteArtifact(id: string): Promise<void> {
    await this.db
      .delete(artifactTable)
      .where(
        and(
          eq(artifactTable.id, id),
          eq(artifactTable.userId, this.userId),
          eq(artifactTable.threadId, this.threadId)
        )
      );
  }
}

// Artifact State Manager
export class MessageStateManager implements StateManager<UIMessage[]> {
  constructor(
    private db: Database,
    private userId: string,
    private threadId: string
  ) {}

  async load(): Promise<UIMessage[]> {
    const messages = await this.db.query.message.findMany({
      where: eq(message.threadId, this.threadId),
    });
    const sortedMessages = messages.sort((a, b) => a.createdAt - b.createdAt);
    return sortedMessages.map((m) => m.message!).filter((m) => m !== null);
  }

  async save(_messages: UIMessage[]): Promise<void> {
    // Artifacts are saved individually, so this is a no-op
    // Individual artifacts are saved via create/update methods
    await this.db.insert(message).values(
      _messages.map((m) => ({
        id: m.id || nanoid(),
        threadId: this.threadId,
        message: m,
        createdAt: Date.now(),
      }))
    );
  }

  async update(_updater: (state: UIMessage[]) => UIMessage[]): Promise<void> {
    // Individual updates are handled by specific methods
    // This is a no-op for now
    await this.save(_updater(await this.load()));
  }

  async clear(): Promise<void> {
    await this.db.delete(message).where(
      and(
        //   eq(message.userId, this.userId),
        eq(message.threadId, this.threadId)
      )
    );
  }
}

// Composite State Manager
export class CompositeStateManager
  implements
    StateManager<{
      memory: MemoryState[];
      todos: TodoState[];
      artifacts: ArtifactState[];
    }>
{
  constructor(
    private memoryManager: MemoryStateManager,
    private todoManager: TodoStateManager,
    private artifactManager: ArtifactStateManager
  ) {}

  async load() {
    const [memory, todos, artifacts] = await Promise.all([
      this.memoryManager.load(),
      this.todoManager.load(),
      this.artifactManager.load(),
    ]);

    return { memory, todos, artifacts };
  }

  async save(state: {
    memory: MemoryState[];
    todos: TodoState[];
    artifacts: ArtifactState[];
  }) {
    await Promise.all([
      this.memoryManager.save(state.memory),
      this.todoManager.save(state.todos),
      this.artifactManager.save(state.artifacts),
    ]);
  }

  async update(
    updater: (state: {
      memory: MemoryState[];
      todos: TodoState[];
      artifacts: ArtifactState[];
    }) => {
      memory: MemoryState[];
      todos: TodoState[];
      artifacts: ArtifactState[];
    }
  ) {
    const current = await this.load();
    const updated = updater(current);
    await this.save(updated);
  }

  async clear() {
    await Promise.all([
      this.memoryManager.clear(),
      this.todoManager.clear(),
      this.artifactManager.clear(),
    ]);
  }
}

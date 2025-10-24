import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { UIMessage } from "ai";
import { message } from "@/db/schema";
import { Database } from "@/db";
import { Provider, BaseAgentContext, ThreadAgentContext } from "./types";

// Message Provider
export class MessageProvider
  implements Provider<UIMessage[], ThreadAgentContext>
{
  constructor(private db: Database) {}

  async load(context: ThreadAgentContext): Promise<UIMessage[]> {
    const messages = await this.db.query.message.findMany({
      where: eq(message.threadId, context.threadId),
    });

    return messages
      .map((msg) => msg.message)
      .filter((msg) => msg !== null) as UIMessage[];
  }

  async save(
    context: ThreadAgentContext,
    messages: UIMessage[]
  ): Promise<void> {
    // Clear existing messages
    await this.db.delete(message).where(eq(message.threadId, context.threadId));

    // Insert new messages
    if (messages.length > 0) {
      await this.db.insert(message).values(
        messages.map((msg) => ({
          id: msg.id || nanoid(),
          threadId: context.threadId,
          message: msg,
          createdAt: Date.now(),
        }))
      );
    }
  }

  async delete(_context: ThreadAgentContext, id: string): Promise<void> {
    await this.db.delete(message).where(eq(message.id, id));
  }

  async addMessage(
    context: ThreadAgentContext,
    newMessage: UIMessage
  ): Promise<void> {
    await this.db.insert(message).values({
      id: newMessage.id || nanoid(),
      threadId: context.threadId,
      message: newMessage,
      createdAt: Date.now(),
    });
  }

  async clearMessages(context: ThreadAgentContext): Promise<void> {
    await this.db.delete(message).where(eq(message.threadId, context.threadId));
  }
}

// Generic Database Provider - Simplified for now
export class DatabaseProvider<T, C extends BaseAgentContext>
  implements Provider<T[], C>
{
  constructor(
    private _db: Database,
    private _table: Record<string, unknown>,
    private _contextField: keyof C,
    private _contextValue: (context: C) => string
  ) {}

  async load(_context: C): Promise<T[]> {
    // Simplified implementation - would need proper table typing
    return [];
  }

  async save(_context: C, _data: T[]): Promise<void> {
    // Simplified implementation - would need proper table typing
  }

  async delete(_context: C, _id: string): Promise<void> {
    // Simplified implementation - would need proper table typing
  }
}

// Cached Provider for performance
export class CachedProvider<T, C extends BaseAgentContext>
  implements Provider<T[], C>
{
  private cache = new Map<string, T[]>();
  private lastLoad = new Map<string, number>();
  private ttl: number;

  constructor(
    private provider: Provider<T[], C>,
    ttlMs: number = 5 * 60 * 1000 // 5 minutes default
  ) {
    this.ttl = ttlMs;
  }

  private getCacheKey(context: C): string {
    return `${context.userId}-${(context as { threadId?: string }).threadId || "global"}`;
  }

  private isExpired(cacheKey: string): boolean {
    const lastLoadTime = this.lastLoad.get(cacheKey);
    if (!lastLoadTime) return true;
    return Date.now() - lastLoadTime > this.ttl;
  }

  async load(context: C): Promise<T[]> {
    const cacheKey = this.getCacheKey(context);

    if (this.cache.has(cacheKey) && !this.isExpired(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const data = await this.provider.load(context);
    this.cache.set(cacheKey, data);
    this.lastLoad.set(cacheKey, Date.now());

    return data;
  }

  async save(context: C, data: T[]): Promise<void> {
    await this.provider.save(context, data);

    const cacheKey = this.getCacheKey(context);
    this.cache.set(cacheKey, data);
    this.lastLoad.set(cacheKey, Date.now());
  }

  async delete(context: C, id: string): Promise<void> {
    await this.provider.delete(context, id);

    const cacheKey = this.getCacheKey(context);
    this.cache.delete(cacheKey);
    this.lastLoad.delete(cacheKey);
  }

  clearCache(): void {
    this.cache.clear();
    this.lastLoad.clear();
  }

  invalidateCache(context: C): void {
    const cacheKey = this.getCacheKey(context);
    this.cache.delete(cacheKey);
    this.lastLoad.delete(cacheKey);
  }
}

// Provider Factory
export class ProviderFactory {
  static createMessageProvider(db: Database): MessageProvider {
    return new MessageProvider(db);
  }

  static createCachedMessageProvider(
    db: Database,
    ttlMs?: number
  ): CachedProvider<UIMessage, ThreadAgentContext> {
    const baseProvider = new MessageProvider(db);
    return new CachedProvider(baseProvider, ttlMs);
  }

  static createDatabaseProvider<T, C extends BaseAgentContext>(
    db: Database,
    table: Record<string, unknown>,
    contextField: keyof C,
    contextValue: (context: C) => string
  ): DatabaseProvider<T, C> {
    return new DatabaseProvider(db, table, contextField, contextValue);
  }
}

// Provider Manager for dependency injection
export class ProviderManager {
  private providers = new Map<string, Provider<unknown, BaseAgentContext>>();

  register<T, C extends BaseAgentContext>(
    name: string,
    provider: Provider<T, C>
  ): void {
    this.providers.set(name, provider as Provider<unknown, BaseAgentContext>);
  }

  get<T, C extends BaseAgentContext>(name: string): Provider<T, C> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    return provider as unknown as Provider<T, C>;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  remove(name: string): boolean {
    return this.providers.delete(name);
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

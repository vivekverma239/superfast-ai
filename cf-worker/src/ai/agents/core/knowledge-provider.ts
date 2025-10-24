import { Database } from "@/db";
import { Storage } from "@/storage";
import { VectorStore } from "@/vector-store";
import { answerFromPDF, similaritySearchFile } from "@/services/files";
import { BaseAgentContext } from "./types";

export interface KnowledgeBaseQuery {
  query: string;
  userId: string;
  folderId?: string;
  limit?: number;
}

export interface DocumentQuery {
  documentId: string;
  query: string;
  userId: string;
}

export interface KnowledgeBaseResult {
  id: string;
  title: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentAnswer {
  text: string;
  sources?: Array<{
    documentId: string;
    page?: number;
    excerpt?: string;
  }>;
}

// Knowledge Base Provider Interface
export interface KnowledgeBaseProvider {
  searchSimilar(query: KnowledgeBaseQuery): Promise<KnowledgeBaseResult[]>;
  answerFromDocument(query: DocumentQuery): Promise<DocumentAnswer>;
  getDocumentMetadata(
    documentId: string,
    userId: string
  ): Promise<Record<string, unknown> | null>;
}

// Concrete implementation
export class DefaultKnowledgeBaseProvider implements KnowledgeBaseProvider {
  constructor(
    private db: Database,
    private storage: Storage,
    private vectorStore: VectorStore
  ) {}

  async searchSimilar(
    query: KnowledgeBaseQuery
  ): Promise<KnowledgeBaseResult[]> {
    const results = await similaritySearchFile({
      userId: query.userId,
      query: query.query,
      vectorStore: this.vectorStore,
      folderId: query.folderId,
      db: this.db,
    });

    return results.map((result) => ({
      id: result.id || "",
      title: result.title || "",
      content: result.metadata?.summary || "",
      score: result.score,
      metadata: result.metadata || {},
    }));
  }

  async answerFromDocument(query: DocumentQuery): Promise<DocumentAnswer> {
    const answer = await answerFromPDF({
      messages: query.query,
      fileId: query.documentId,
      storage: this.storage,
      db: this.db,
      vectorStore: this.vectorStore,
      streaming: false,
    });

    return {
      text: answer.text,
      sources: [
        {
          documentId: query.documentId,
        },
      ],
    };
  }

  async getDocumentMetadata(
    documentId: string,
    userId: string
  ): Promise<Record<string, unknown> | null> {
    // This would typically query the database for document metadata
    // For now, return a simple structure
    return {
      id: documentId,
      userId,
      type: "document",
    };
  }
}

// Knowledge Base Provider Factory
export class KnowledgeBaseProviderFactory {
  static create(context: BaseAgentContext): KnowledgeBaseProvider {
    const provider = new DefaultKnowledgeBaseProvider(
      context.db,
      context.storage,
      context.vectorStore
    );

    return provider;
  }

  static createWithCustomProvider(
    provider: KnowledgeBaseProvider
  ): KnowledgeBaseProvider {
    return provider;
  }
}

// Mock Knowledge Base Provider for testing
export class MockKnowledgeBaseProvider implements KnowledgeBaseProvider {
  async searchSimilar(
    query: KnowledgeBaseQuery
  ): Promise<KnowledgeBaseResult[]> {
    return [
      {
        id: "mock-1",
        title: "Mock Document",
        content: `Mock content for query: ${query.query}`,
        score: 0.95,
        metadata: { source: "mock" },
      },
    ];
  }

  async answerFromDocument(query: DocumentQuery): Promise<DocumentAnswer> {
    return {
      text: `Mock answer for document ${query.documentId}: ${query.query}`,
      sources: [{ documentId: query.documentId }],
    };
  }

  async getDocumentMetadata(
    documentId: string,
    userId: string
  ): Promise<Record<string, unknown> | null> {
    return {
      id: documentId,
      userId,
      type: "mock-document",
    };
  }
}

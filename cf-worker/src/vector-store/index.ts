export enum VectorEntity {
  FILE = "file",
}

export interface Vector {
  id: string;
  entity: VectorEntity;
  userId: string;
  metadata: Record<string, VectorizeVectorMetadataValue>;
  embeddings: number[];
}

export class VectorStore {
  private vectorStore: Vectorize;

  constructor(vectorStore: Vectorize) {
    this.vectorStore = vectorStore;
  }

  async insert(vectors: Vector[]): Promise<void> {
    const vectorsToInsert: VectorizeVector[] = vectors.map((vector) => ({
      id: vector.id,
      namespace: `${vector.userId}-${vector.entity}`,
      metadata: {
        userId: vector.userId,
        ...vector.metadata,
      },
      values: vector.embeddings,
    }));
    console.log("Inserting vectors", vectorsToInsert.length);
    console.log(this.vectorStore);
    await this.vectorStore.insert(vectorsToInsert);
  }

  async query({
    embedding,
    userId,
    entity,
    filter,
    topK = 10,
  }: {
    embedding: number[];
    userId: string;
    filter?: VectorizeVectorMetadataFilter;
    entity: VectorEntity;
    topK?: number;
  }): Promise<VectorizeMatches> {
    return await this.vectorStore.query(embedding, {
      namespace: `${userId}-${entity}`,
      filter,
      topK,
    });
  }

  async delete(id: string): Promise<void> {
    await this.vectorStore.deleteByIds([id]);
  }
}

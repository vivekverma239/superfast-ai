import { File } from "@/types";
import { Vector, VectorEntity, VectorStore } from "@/vector-store";
import { Database } from "@/db";
import { BasicPdfParseResult, parseBasicPDF } from "@/ai/workflows/parsePdf";
import { Storage } from "@/storage";
import { file } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getEmbeddings } from "@/ai/embeddings";
import { getPdfHash } from "@/utils/pdf";
import { answerFromPDFWithTOC, PDFAnswerAgent } from "@/ai/agents/fileAnswer";
import { convertToModelMessages, UIMessage } from "ai";

export const indexFile = async ({
  fileRecord,
  vectorStore,
  storage,
  db,
}: {
  fileRecord: File;
  vectorStore: VectorStore;
  storage: Storage;
  db: Database;
}): Promise<void> => {
  // Download the file from storage
  // Parse the file
  const fileBuffer = await storage.download(fileRecord.s3Key);
  if (!fileBuffer) {
    throw new Error(`Failed to download file: ${fileRecord.s3Key}`);
  }
  const hash = await getPdfHash(fileBuffer);
  const buffer = new Uint8Array(fileBuffer);

  // Try to get the parsed result from the storage
  const cachedParseResult = await storage.getCachedObject<BasicPdfParseResult>(
    `parse-result-${hash}`
  );

  let parseResult: BasicPdfParseResult;
  if (cachedParseResult) {
    parseResult = cachedParseResult;
  } else {
    parseResult = await parseBasicPDF(undefined, buffer);
    await storage.putCachedObject(`parse-result-${hash}`, parseResult);
  }

  // Update the file record with status
  const updatedFileRecords = await db
    .update(file)
    .set({
      status: "indexed",
      metadata: {
        ...parseResult.metadata,
        toc: parseResult.toc,
        totalPages: parseResult.totalPages,
      },
    })
    .where(eq(file.id, fileRecord.id))
    .returning();
  if (updatedFileRecords.length === 0) {
    throw new Error(`Failed to update file: ${fileRecord.id}`);
  }
  const updatedFileRecord = updatedFileRecords[0]!;

  // Create embeddings and store in vector store
  const embeddings = await getEmbeddings([
    `
    Title: ${updatedFileRecord.metadata?.title}
    Summary: ${updatedFileRecord.metadata?.summary}
    `,
  ]);
  if (embeddings.length === 0) {
    throw new Error(`Failed to create embeddings: ${fileRecord.id}`);
  }
  const embedding = embeddings[0]!;
  const vector: Vector = {
    id: fileRecord.id,
    entity: VectorEntity.FILE,
    userId: fileRecord.userId,
    metadata: {
      title: updatedFileRecord.metadata?.title ?? "",
      folderId: fileRecord.folderId,
    },
    embeddings: embedding,
  };
  await vectorStore.insert([vector]);
};

export const deleteFile = async ({
  fileRecord,
  vectorStore,
  storage,
  db,
}: {
  fileRecord: File;
  vectorStore: VectorStore;
  storage: Storage;
  db: Database;
}): Promise<void> => {
  // Delete the file from the database
  // Delete the file from the vector store
  await vectorStore.delete(fileRecord.id);
  await db.delete(file).where(eq(file.id, fileRecord.id));
  await storage.delete(fileRecord.s3Key);
};

export const similaritySearchFile = async ({
  userId,
  query,
  vectorStore,
  folderId,
  db,
}: {
  userId: string;
  query: string;
  vectorStore: VectorStore;
  folderId?: string;
  db: Database;
}): Promise<(File & { score: number })[]> => {
  const embeddings = await getEmbeddings([query]);
  const embedding = embeddings[0]!;
  const vectors = await vectorStore.query({
    embedding,
    userId: userId,
    entity: VectorEntity.FILE,
    filter: folderId ? { folderId: { $eq: folderId } } : undefined,
  });
  const fileIds = vectors.matches.map((match) => match.id);
  const fileRecords = await db
    .select()
    .from(file)
    .where(inArray(file.id, fileIds as string[]));
  const results = vectors.matches
    .map((match) => {
      const matchedFile = fileRecords.find((record) => record.id === match.id);
      if (!matchedFile) {
        return null;
      }
      return { ...matchedFile, score: match.score };
    })
    .filter((result) => result !== null) as (File & { score: number })[];

  return results;
};

export const answerFromPDF = async ({
  messages,
  fileId,
  storage,
  db,
}: {
  messages: UIMessage[];
  fileId: string;
  storage: Storage;
  db: Database;
}) => {
  // Get toc
  const fileRecord = await db
    .select()
    .from(file)
    .where(eq(file.id, fileId))
    .get();
  if (!fileRecord) {
    throw new Error(`Failed to get toc: ${fileId}`);
  }
  const pdfBuffer = await storage.download(fileRecord.s3Key);
  if (!pdfBuffer) {
    throw new Error(`Failed to download file: ${fileRecord.s3Key}`);
  }
  const toc = fileRecord.metadata?.toc;
  if (!toc) {
    throw new Error(`Failed to get toc: ${fileId}`);
  }
  const result = PDFAnswerAgent.toUIMessageStream({
    context: {
      fileId,
      fileBuffer: new Buffer(pdfBuffer),
      toc,
    },
    messages: convertToModelMessages(messages),
  });
  return result;
};

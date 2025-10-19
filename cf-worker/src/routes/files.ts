import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc } from "drizzle-orm";
import { file } from "@/db/schema";
import { createFileSchema } from "../schemas";
import type { AppType } from "../types";
import { nanoid } from "nanoid";
import {
  indexFile,
  deleteFile,
  similaritySearchFile,
  answerFromPDF,
} from "@/services/files";
import { UIMessage } from "ai";

const files = new Hono<AppType>();

// GET /files?folderId=xxx - List files
files.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const folderId = c.req.query("folderId");

  let query = db.select().from(file).where(eq(file.userId, userId));

  if (folderId) {
    query = db
      .select()
      .from(file)
      .where(and(eq(file.userId, userId), eq(file.folderId, folderId)));
  }

  const files = await query.orderBy(desc(file.createdAt));

  return c.json(files);
});

// POST /files - Create file record and get upload URL
files.post("/", zValidator("json", createFileSchema), async (c) => {
  const db = c.get("db");
  const storage = c.get("storage");
  const userId = c.get("userId");
  const { title, folderId, fileType, fileSize } = c.req.valid("json");

  const s3Key = `${userId}/${folderId}/${nanoid()}`;

  // Get signed upload URL
  const uploadUrl = await storage.getUploadUrl(s3Key);

  // Create file record
  const newFile = await db
    .insert(file)
    .values({
      title,
      folderId,
      s3Key,
      fileType: fileType || null,
      fileSize: fileSize || null,
      userId,
      status: "pending",
    })
    .returning();

  return c.json(
    {
      file: newFile[0],
      uploadUrl,
    },
    201
  );
});

files.get("/search", async (c) => {
  const userId = c.get("userId");
  const query = c.req.query("query") ?? "";
  const folderId = c.req.query("folderId");
  const vectorStore = c.get("vectorStore");
  const db = c.get("db");
  if (!vectorStore || !db) {
    return c.json({ error: "Vector store or database not found" }, 500);
  }

  const results = await similaritySearchFile({
    userId,
    query,
    vectorStore,
    db,
    folderId,
  });

  return c.json(results);
});

// POST /files/:fileId/complete - Client notifies upload result; index on success, cleanup on failure
files.post("/:fileId/complete", async (c) => {
  const db = c.get("db");
  const vectorStore = c.get("vectorStore");
  const storage = c.get("storage");
  const userId = c.get("userId");
  const fileId = c.req.param("fileId");

  const body = await c.req
    .json<{ success?: boolean }>()
    .catch(() => ({ success: false }));
  const success = Boolean(body?.success);

  const fileRecord = await db
    .select()
    .from(file)
    .where(and(eq(file.id, fileId), eq(file.userId, userId)))
    .limit(1);

  if (fileRecord.length === 0) {
    return c.json({ error: "File not found" }, 404);
  }

  if (!success) {
    await deleteFile({ fileRecord: fileRecord[0]!, vectorStore, storage, db });
    return c.json({ success: true, deleted: true });
  }

  await indexFile({ fileRecord: fileRecord[0]!, vectorStore, storage, db });
  return c.json({ success: true, indexed: true });
});

// GET /files/:fileId - Get file details with download URL
files.get("/:fileId", async (c) => {
  const db = c.get("db");
  const storage = c.get("storage");
  const userId = c.get("userId");
  const fileId = c.req.param("fileId");

  const fileRecord = await db
    .select()
    .from(file)
    .where(and(eq(file.id, fileId), eq(file.userId, userId)))
    .limit(1);

  if (fileRecord.length === 0) {
    return c.json({ error: "File not found" }, 404);
  }

  // Generate signed download URL
  const downloadUrl = await storage.getUrl(fileRecord[0]!.s3Key);

  return c.json({
    ...fileRecord[0],
    downloadUrl,
  });
});

// DELETE /files/:fileId - Delete file
files.delete("/:fileId", async (c) => {
  const db = c.get("db");
  const storage = c.get("storage");
  const userId = c.get("userId");
  const fileId = c.req.param("fileId");

  const fileRecord = await db
    .select()
    .from(file)
    .where(and(eq(file.id, fileId), eq(file.userId, userId)))
    .limit(1);

  if (fileRecord.length === 0) {
    return c.json({ error: "File not found" }, 404);
  }

  // Delete from storage
  await storage.delete(fileRecord[0]!.s3Key);

  // Delete from database
  await db.delete(file).where(eq(file.id, fileId));

  return c.json({ success: true });
});

files.post("/:fileId/index", async (c) => {
  const db = c.get("db");
  const vectorStore = c.get("vectorStore");
  const storage = c.get("storage");
  const fileId = c.req.param("fileId");

  const userId = c.get("userId");

  const fileRecord = await db.select().from(file).where(eq(file.id, fileId));

  if (fileRecord.length === 0) {
    return c.json({ error: "File not found" }, 404);
  }

  if (fileRecord[0]!.userId !== userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // if (fileRecord[0]!.status === "indexed") {
  //   return c.json({ error: "File already indexed" }, 400);
  // }

  if (fileRecord[0]!.status === "error") {
    return c.json({ error: "Failed to index file" }, 400);
  }

  if (!vectorStore) {
    return c.json({ error: "Vector store not found" }, 500);
  }

  console.log("Vector store", vectorStore);

  await indexFile({ fileRecord: fileRecord[0]!, vectorStore, storage, db });

  return c.json({ success: true });
});

files.post("/:fileId/answer", async (c) => {
  const fileId = c.req.param("fileId");

  const storage = c.get("storage");
  const db = c.get("db");
  const data = await c.req.json<{
    messages: UIMessage[];
  }>();

  if (!data.messages) {
    return c.json({ error: "Messages are required" }, 400);
  }

  const result = await answerFromPDF({
    fileId,
    messages: data.messages,
    storage,
    db,
  });

  return result;
});

export default files;

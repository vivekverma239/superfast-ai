import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc } from "drizzle-orm";
import { file } from "@/db/schema";
import { createFileSchema } from "../schemas";
import type { AppType } from "../types";
import { nanoid } from "nanoid";

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

  const s3Key = `${userId}/${folderId}/${nanoid()}-${title}`;

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

export default files;

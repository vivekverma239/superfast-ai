import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc } from "drizzle-orm";
import { folder, file } from "@/db/schema";
import { createFolderSchema, updateFolderSchema } from "../schemas";
import type { AppType } from "../types";

const folders = new Hono<AppType>();

// GET /folders - List all folders with file counts
folders.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const folders = await db
    .select()
    .from(folder)
    .where(eq(folder.userId, userId))
    .orderBy(desc(folder.createdAt));

  // Get file counts for each folder
  const foldersWithCounts = await Promise.all(
    folders.map(async (f) => {
      const files = await db.select().from(file).where(eq(file.folderId, f.id));

      return {
        ...f,
        fileCount: files.length,
      };
    })
  );

  return c.json(foldersWithCounts);
});

// GET /folders/:folderId - Get folder details with file count
folders.get("/:folderId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const folderId = c.req.param("folderId");

  const folderRecord = await db
    .select()
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.userId, userId)))
    .limit(1);

  if (folderRecord.length === 0) {
    return c.json({ error: "Folder not found" }, 404);
  }

  // Get file count for the folder
  const files = await db.select().from(file).where(eq(file.folderId, folderId));

  return c.json({
    ...folderRecord[0],
    fileCount: files.length,
  });
});

// POST /folders - Create new folder
folders.post("/", zValidator("json", createFolderSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const { name } = c.req.valid("json");

  const newFolder = await db
    .insert(folder)
    .values({
      name,
      userId,
    })
    .returning();

  return c.json(newFolder[0], 201);
});

// PATCH /folders/:folderId - Update folder
folders.patch(
  "/:folderId",
  zValidator("json", updateFolderSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const folderId = c.req.param("folderId");
    const { name } = c.req.valid("json");

    const updated = await db
      .update(folder)
      .set({ name })
      .where(and(eq(folder.id, folderId), eq(folder.userId, userId)))
      .returning();

    if (updated.length === 0) {
      return c.json({ error: "Folder not found" }, 404);
    }

    return c.json(updated[0]);
  }
);

// DELETE /folders/:folderId - Delete folder
folders.delete("/:folderId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const folderId = c.req.param("folderId");

  // Check if folder exists and belongs to user
  const existingFolder = await db
    .select()
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.userId, userId)))
    .limit(1);

  if (existingFolder.length === 0) {
    return c.json({ error: "Folder not found" }, 404);
  }

  // Delete all files in the folder
  await db.delete(file).where(eq(file.folderId, folderId));

  // Delete the folder
  await db.delete(folder).where(eq(folder.id, folderId));

  return c.json({ success: true });
});

export default folders;

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, asc } from "drizzle-orm";
import { chat, message } from "@/db/schema";
import { createChatSchema } from "../schemas";
import type { AppType } from "../types";

const chats = new Hono<AppType>();

// GET /chats - List all chats
chats.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const allChats = await db
    .select()
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.updatedAt));

  return c.json(allChats);
});

// POST /chats - Create new chat
chats.post("/", zValidator("json", createChatSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const { title, folderId } = c.req.valid("json");

  const newChat = await db
    .insert(chat)
    .values({
      title: title || "New Chat",
      folderId: folderId || null,
      userId,
    })
    .returning();

  return c.json(newChat[0], 201);
});

// GET /chats/:chatId - Get chat with messages
chats.get("/:threadId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const threadId = c.req.param("threadId");

  const chatRecord = await db
    .select()
    .from(chat)
    .where(and(eq(chat.id, threadId), eq(chat.userId, userId)))
    .limit(1);

  if (chatRecord.length === 0) {
    return c.json({ error: "Chat not found" }, 404);
  }

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.threadId, threadId))
    .orderBy(asc(message.createdAt));

  return c.json({
    ...chatRecord[0],
    messages,
  });
});

// DELETE /chats/:chatId - Delete chat
chats.delete("/:chatId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");

  // Delete all messages in the chat
  await db.delete(message).where(eq(message.threadId, chatId));

  // Delete the chat
  const deleted = await db
    .delete(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "Chat not found" }, 404);
  }

  return c.json({ success: true });
});

// POST /chats/:chatId/messages - Send message and stream AI response
// chats.post(
//   "/:chatId/messages",
//   zValidator("json", sendMessageSchema),
//   async (c) => {
//     const db = c.get("db");
//     const userId = c.get("userId");
//     const chatId = c.req.param("chatId");
//     const { content } = c.req.valid("json");

//     // Get chat details
//     const chatRecord = await db
//       .select()
//       .from(chat)
//       .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
//       .limit(1);

//     if (chatRecord.length === 0) {
//       return c.json({ error: "Chat not found" }, 404);
//     }

//     // Get relevant files based on folderId
//     let relevantFiles;
//     if (chatRecord[0].folderId) {
//       relevantFiles = await db
//         .select()
//         .from(file)
//         .where(eq(file.folderId, chatRecord[0].folderId));
//     } else {
//       relevantFiles = await db
//         .select()
//         .from(file)
//         .where(eq(file.userId, userId));
//     }

//     // Get previous messages
//     const previousMessages = await db
//       .select()
//       .from(message)
//       .where(eq(message.chatId, chatId))
//       .orderBy(asc(message.createdAt));

//     // Save user message
//     await db.insert(message).values({
//       chatId,
//       role: "user",
//       content,
//     });

//     // Update chat updatedAt
//     await db
//       .update(chat)
//       .set({ updatedAt: Date.now() })
//       .where(eq(chat.id, chatId));

//     // Build context from files
//     const fileContext = relevantFiles
//       .map(
//         (f) =>
//           `Document: ${f.title}\n${
//             f.metadata?.summary || "No summary available"
//           }`
//       )
//       .join("\n\n");

//     const systemPrompt = `You are a helpful AI assistant that answers questions based on the user's documents.

// Available documents:
// ${fileContext || "No documents available"}

// Instructions:
// - Answer questions based on the provided documents
// - If you don't have enough information in the documents, say so
// - Be concise and accurate
// - Cite which document you're referencing when possible`;

//     // Stream the response
//     const result = streamText({
//       model: openai("gpt-4o-mini"),
//       system: systemPrompt,
//       messages: [
//         ...previousMessages.map((m) => ({
//           role: m.role as "user" | "assistant",
//           content: m.content,
//         })),
//         { role: "user", content },
//       ],
//       async onFinish({ text }) {
//         // Save assistant message
//         await db.insert(message).values({
//           chatId,
//           role: "assistant",
//           content: text,
//           metadata: {
//             sources: relevantFiles.slice(0, 3).map((f) => ({
//               fileId: f.id,
//               fileName: f.title,
//               excerpt: f.metadata?.summary || "",
//             })),
//           },
//         });

//         // Update chat title if it's the first message
//         if (previousMessages.length === 0) {
//           const title =
//             content.slice(0, 50) + (content.length > 50 ? "..." : "");
//           await db.update(chat).set({ title }).where(eq(chat.id, chatId));
//         }
//       },
//     });

//     return result.toDataStreamResponse();
//   }
// );

export default chats;

import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const folder = sqliteTable(
  "folder",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    name: text({ length: 255 }).notNull(),
    userId: text({ length: 40 }).notNull(),
    createdAt: integer()
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("folder_userid_idx").on(table.userId, table.createdAt)]
);

export const file = sqliteTable(
  "file",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    title: text({ length: 255 }).notNull(),
    folderId: text({ length: 21 }).notNull(),
    s3Key: text({ length: 255 }).notNull(),
    fileType: text({ length: 50 }),
    fileSize: integer(),
    metadata: text({ mode: "json" }).$type<{
      summary?: string;
      tags?: string[];
      pageCount?: number;
    }>(),
    userId: text({ length: 40 }).notNull(),
    createdAt: integer()
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index("file_userid_idx").on(table.userId, table.createdAt),
    index("file_folderid_idx").on(table.folderId),
  ]
);

export const chat = sqliteTable(
  "chat",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    title: text({ length: 255 }),
    // null means chat with all folders, specific ID means chat with that folder only
    folderId: text({ length: 21 }),
    userId: text({ length: 40 }).notNull(),
    createdAt: integer()
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer()
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("chat_userid_idx").on(table.userId, table.updatedAt)]
);

export const message = sqliteTable(
  "message",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    chatId: text({ length: 21 }).notNull(),
    role: text({ enum: ["user", "assistant"] }).notNull(),
    content: text().notNull(),
    metadata: text({ mode: "json" }).$type<{
      sources?: { fileId: string; fileName: string; excerpt: string }[];
    }>(),
    createdAt: integer()
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("message_chatid_idx").on(table.chatId, table.createdAt)]
);

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import {
  BasicPdfParseResult,
  DocumentMetadata,
  Toc,
} from "@/ai/workflows/parsePdf";
import { Artifact, Memory } from "@/mastra/agents/researcher";
import { UIMessage } from "ai";

export type FileMetadata = DocumentMetadata & {
  toc: Toc;
  totalPages: number;
};

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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
    metadata: text({ mode: "json" }).$type<FileMetadata>(),
    userId: text({ length: 40 }).notNull(),
    status: text({ enum: ["pending", "indexed", "error"] })
      .default("pending")
      .notNull(),
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
  (table) => [
    index("chat_sesssion_userid_idx").on(table.userId, table.updatedAt),
  ]
);

export const message = sqliteTable(
  "message",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    threadId: text({ length: 21 }).notNull(),
    message: text({ mode: "json" }).$type<UIMessage>(),
    metadata: text({ mode: "json" }).$type<{
      sources?: { fileId: string; fileName: string; excerpt: string }[];
    }>(),
    createdAt: integer()
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index("thread_message_threadid_idx").on(table.threadId, table.createdAt),
  ]
);

export const memory = sqliteTable(
  "memory",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text({ length: 40 }).notNull(),
    memory: text({ mode: "json" }).$type<Memory[]>(),
  },
  (table) => [uniqueIndex("memory_userid_idx").on(table.userId)]
);

export const artifact = sqliteTable(
  "artifact",
  {
    id: text({ length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text({ length: 40 }).notNull(),
    threadId: text({ length: 21 }).notNull(),
    artifact: text({ mode: "json" }).$type<Artifact>().notNull(),
  },
  (table) => [
    uniqueIndex("artifact_userid_idx").on(table.userId),
    index("artifact_threadid_idx").on(table.threadId),
  ]
);

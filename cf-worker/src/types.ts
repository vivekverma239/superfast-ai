import { Database } from "@/db";
import { file, folder, message, chat } from "@/db/schema";
import { Storage } from "./storage";
import { VectorStore } from "./vector-store";

// Cloudflare bindings
export type Bindings = {
  BUCKET: R2Bucket;
  DB: D1Database;
  VECTOR_STORE: Vectorize;
  ACCOUNT_ID: string;
  ACCESS_KEY_ID: string;
  SECRET_ACCESS_KEY: string;
  BUCKET_NAME: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OPENROUTER_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  OPENAI_API_KEY: string;
  BRAINTRUST_API_KEY: string;
  AXIOM_API_KEY: string;
};

// Variables available in context after middleware
export type Variables = {
  storage: Storage;
  db: Database;
  vectorStore: VectorStore;
  userId: string; // Will be set by auth middleware
};

// Complete Hono app type
export type AppType = {
  Bindings: Bindings;
  Variables: Variables;
};

export type File = typeof file.$inferSelect;
export type Folder = typeof folder.$inferSelect;
export type Message = typeof message.$inferSelect;
export type Chat = typeof chat.$inferSelect;

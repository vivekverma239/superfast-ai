import { Database } from "@/db";
import { Storage } from "../storage";

// Cloudflare bindings
export type Bindings = {
  BUCKET: R2Bucket;
  DB: D1Database;
  ACCOUNT_ID: string;
  ACCESS_KEY_ID: string;
  SECRET_ACCESS_KEY: string;
  BUCKET_NAME: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

// Variables available in context after middleware
export type Variables = {
  storage: Storage;
  db: Database;
  userId: string; // Will be set by auth middleware
};

// Complete Hono app type
export type AppType = {
  Bindings: Bindings;
  Variables: Variables;
};

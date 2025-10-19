import { getDb } from "@/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Storage } from "./storage";
import type { AppType, Bindings } from "./types";
import { auth } from "./utils/auth";
// Import routes
import folders from "./routes/folders";
import files from "./routes/files";
import chats from "./routes/chats";
import agents from "./routes/agents";
import { VectorStore } from "./vector-store";
import { instrument, ResolveConfigFn } from "@microlabs/otel-cf-workers";

const app = new Hono<AppType>();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",

      "http://localhost:3002",
      "https://superfast-ai.vercel.app",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Storage and Database middleware
app.use("*", async (c, next) => {
  try {
    // Initialize storage
    const storage = new Storage(
      c.env.BUCKET,
      c.env.ACCOUNT_ID,
      c.env.ACCESS_KEY_ID,
      c.env.SECRET_ACCESS_KEY,
      c.env.BUCKET_NAME
    );
    c.set("storage", storage);

    // Initialize database
    const db = getDb(c.env.DB);
    c.set("db", db);

    if (!c.env.VECTOR_STORE) {
      return c.json({ error: "Vector store not found" }, 500);
    }
    // Initialize vector store
    const vectorStore = new VectorStore(c.env.VECTOR_STORE);
    c.set("vectorStore", vectorStore);

    return next();
  } catch (error) {
    console.error("Middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Better Auth routes under /api/auth/*
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return auth(c.env).handler(c.req.raw);
});

// Authentication middleware for protected API routes
app.use("/api/*", async (c, next) => {
  // Skip auth for the auth endpoints themselves
  if (c.req.path.startsWith("/api/auth/")) return next();

  const session = await auth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });
  const userId = session?.user?.id;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", userId);
  return next();
});

// Routes
app.get("/", (c) => {
  return c.json({
    message: "Document Chat API",
    version: "1.0.0",
    endpoints: {
      folders: "/api/folders",
      files: "/api/files",
      chats: "/api/chats",
    },
  });
});

app.route("/api/folders", folders);
app.route("/api/files", files);
app.route("/api/chats", chats);
app.route("/api/agents", agents);
// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Application error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
    },
    500
  );
});

const config: ResolveConfigFn = (env: Bindings, _trigger) => {
  console.log(process.env.BRAINTRUST_API_KEY);
  return {
    exporter: {
      url: "https://api.braintrust.dev/otel/v1/traces",
      headers: {
        Authorization: `Bearer ${process.env.BRAINTRUST_API_KEY}`,
        "x-bt-parent": `project_name:superfast-ai`,
      },
    },
    // exporter: {
    //   url: "https://api.axiom.co/v1/traces",
    //   headers: {
    //     Authorization: `Bearer ${process.env.AXIOM_API_KEY}`,
    //     "X-Axiom-Dataset": `superfast-ai`,
    //   },
    // },
    service: { name: "superfast-ai" },
  };
};

export default instrument(app, config);

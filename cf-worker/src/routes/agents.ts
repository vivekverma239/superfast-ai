import { Hono } from "hono";
import type { AppType } from "../types";
import { generalAgent } from "@/ai/agents";
import { zValidator } from "@hono/zod-validator";
import { AI_MODEL, OPENROUTER_MODEL } from "@/ai/aisdk";
import { UIMessage } from "ai";

const agents = new Hono<AppType>();

// GET /chats - List all chats
agents.post("/general", async (c) => {
  const { messages, model, reasoningLevel } = (await c.req.json()) as {
    messages: UIMessage[];
    model: AI_MODEL | OPENROUTER_MODEL;
    reasoningLevel: "none" | "default" | "high";
  };
  const response = await generalAgent({
    messages,
    model,
    reasoningLevel,
  });
  return response;
});

export default agents;

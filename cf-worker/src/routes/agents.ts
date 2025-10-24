import { Hono } from "hono";
import type { AppType } from "../types";
import { AI_MODEL, OPENROUTER_MODEL } from "@/ai/aisdk";
import { UIMessage } from "ai";
import { ResearcherAgent } from "@/ai/agents/researcher-agent";
import { chat } from "@/db/schema";
import { ConfigPresets } from "@/ai/agents/core/config";
import { AgentContextFactory } from "@/ai/agents/core";

const agents = new Hono<AppType>();

// POST /agents/general - General agent endpoint
agents.post("/general", async (c) => {
  const { messages, model, threadId, folderId } = (await c.req.json()) as {
    messages: UIMessage[];
    model: AI_MODEL | OPENROUTER_MODEL;
    threadId?: string;
    folderId?: string;
  };
  // const response = await generalAgent({
  //   messages,
  //   model,
  //   reasoningLevel,
  // });
  // return response;

  // Create a new thread if none is provided
  let currentThreadId = threadId;
  if (!currentThreadId) {
    const db = c.get("db");
    const userId = c.get("userId");

    const newChat = await db
      .insert(chat)
      .values({
        title: "New Chat",
        folderId: folderId || null,
        userId,
      })
      .returning();

    currentThreadId = newChat[0]!.id;
  }

  const context = AgentContextFactory.createThreadContext(
    c.get("db"),
    c.get("storage"),
    c.get("vectorStore"),
    c.get("userId"),
    currentThreadId,
    folderId,
    {
      useKnowledgeBase: true,
      useMemoryManager: true,
      useTodoManager: true,
      useArtifactManager: true,
    }
  );

  const researcherAgent = new ResearcherAgent(context, {
    ...ConfigPresets.RESEARCHER,
    model: model ?? OPENROUTER_MODEL.GROK_4_FAST,
  });

  const response = await researcherAgent.stream(messages[messages.length - 1]!);
  return response;
});

export default agents;

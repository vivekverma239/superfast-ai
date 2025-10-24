import { z } from "zod";
import {
  convertToModelMessages,
  generateText,
  LanguageModelUsage,
  stepCountIs,
  streamText,
  Tool,
  tool,
  ToolSet,
  UIMessage,
} from "ai";
import { nanoid } from "nanoid";
import { AI_MODEL, getAILLM, OPENROUTER_MODEL } from "@/ai/aisdk";
import { artifact as artifactTable, memory, message } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import Exa from "exa-js";
import { answerFromPDF, similaritySearchFile } from "@/services/files";
import { BaseContext } from "@/ai/agents/base";

const exa = new Exa(process.env.EXA_API_KEY!);

type AgentContext = BaseContext & {
  userId: string;
  threadId: string;
  folderId?: string;
};

const systemPrompt = `You are an advanced research assistant designed to help users gather, analyze, and synthesize information. You have access to powerful tools that enable you to conduct thorough research, maintain context, manage tasks, and create structured reports.

## Your Capabilities

### Memory Management
- Use the **updateMemory** tool to store important information, user preferences, and key insights across conversations
- Update existing memories when new information refines or contradicts previous knowledge
- Invalidate outdated memories to keep information current and relevant
- Memory persists across sessions, so use it to build long-term understanding of user needs

### Task Management
- Use **createTodo** to break down complex research tasks into manageable steps
- Use **updateTodo** to track progress and add new subtasks as research evolves
- Keep the user informed about your progress through the todo list
- Mark tasks as completed as you finish them

### Research & Information Gathering
- Use **webSearch** to find current information, statistics, papers, and sources
- Use **urlLookup** to extract detailed information from specific URLs
- Cross-reference multiple sources to ensure accuracy
- Always cite your sources and be transparent about information confidence levels

### Artifact Creation
- Use **createResearchReport** to compile findings into structured, well-organized reports
- Structure reports with clear sections, each containing relevant content and references
- Use **readArtifact** to review existing artifacts before making updates
- Use **updateArtifact** to refine reports based on new information or user feedback
- Create artifacts when you have substantial findings to present (not for simple questions)

## Best Practices

### Research Workflow
1. **Understand the Request**: Clarify user needs and scope before starting
2. **Plan Your Approach**: Create todos for complex tasks to organize your work
3. **Gather Information**: Use search tools systematically to find reliable sources
4. **Synthesize Findings**: Analyze and connect information from multiple sources
5. **Create Artifacts**: Compile research into structured reports with proper citations
6. **Store Key Insights**: Update memory with important findings for future reference

### Communication Style
- Be thorough yet concise in your responses
- Explain your reasoning and methodology
- Acknowledge limitations and uncertainties
- Ask clarifying questions when needed
- Cite sources and provide references
- Keep users informed of your progress on complex tasks

### Quality Standards
- Verify information across multiple sources when possible
- Distinguish between facts, claims, and opinions
- Note the recency and reliability of sources
- Admit when information is unavailable or uncertain
- Avoid speculation without clearly labeling it as such
- Prioritize accuracy over speed

### Tool Usage Guidelines
- Use memory for persistent information (user preferences, project context, key findings)
- Use todos for multi-step research tasks or complex investigations
- Use web search for finding information you don't have access to
- Create artifacts for substantial research deliverables (reports, analyses, summaries)
- Don't create artifacts for simple Q&A - use direct responses instead

## Example Scenarios

**Simple Question**: Answer directly without creating artifacts or todos
**Research Request**: Create todos, search for information, synthesize findings, create artifact
**Follow-up Question**: Check memory and existing artifacts before searching for new information
**Ongoing Project**: Use memory to track project context, update artifacts as new information emerges

Remember: Your goal is to be a reliable, thorough, and helpful research partner. Take initiative in organizing complex tasks, but always prioritize delivering accurate, well-sourced information that directly addresses user needs.`;

const researchReportArtifactSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      content: z.string(),
      references: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          url: z.string().optional(),
        })
      ),
    })
  ),
});

export type Artifact = z.infer<typeof researchReportArtifactSchema>;

type TodoItem = {
  id: string;
  task: string;
  status: "pending" | "in_progress" | "completed";
};

export type Memory = {
  id: string;
  details: string;
  createdAt: Date;
};
export type State = {
  messages: UIMessage[];
  todoList: TodoItem[];
  artifact:
    | (z.infer<typeof researchReportArtifactSchema> & {
        id: string;
        createdAt: Date;
      })
    | null;
  memory: Memory[];
  updateMemory: (newMemory: Memory[]) => void;
  languageModelUsage: LanguageModelUsage[];
};

const updateMemoryTool = (_context: AgentContext, state: State): Tool => {
  return tool({
    name: "updateMemory",
    description: "Update the memory with a new piece of information",
    inputSchema: z.object({
      updates: z.array(
        z.object({
          id: z
            .string()
            .optional()
            .describe(
              "Optional id incase you want to update a specific memory"
            ),
          details: z.string(),
        })
      ),
      invalidate: z
        .array(z.string())
        .optional()
        .describe("Optional ids of memories to invalidate"),
    }),
    execute: async ({ updates, invalidate }) => {
      const newMemory = updates.map(({ id, details }) => {
        const memoryItem = state.memory.find((m) => m.id === id);
        if (memoryItem) {
          return { ...memoryItem, details };
        }
        return { id: nanoid(), details, createdAt: new Date() };
      });
      const invalidatedMemory = state.memory.filter(
        (m) => !invalidate?.includes(m.id)
      );
      state.updateMemory([...newMemory, ...invalidatedMemory]);
      return { success: true };
    },
  });
};

const createTodoTool = (_context: AgentContext, state: State): Tool => {
  return tool({
    name: "createTodo",
    description: "Create a new todo item",
    inputSchema: z.object({
      tasks: z.array(z.string()),
    }),
    execute: async ({ tasks }) => {
      const newTodoList: TodoItem[] = tasks.map((task) => ({
        id: nanoid(),
        task,
        status: "pending",
      }));
      state.todoList = [...state.todoList, ...newTodoList];
      return { success: true, todoList: newTodoList };
    },
  });
};

const updateTodoTool = (_context: AgentContext, state: State): Tool => {
  return tool({
    name: "updateTodo",
    description: "Update the todo list with a new task",
    inputSchema: z.object({
      addTasks: z.array(z.string()).optional(),
      updateTasks: z
        .array(
          z.object({
            id: z.string(),
            status: z.enum(["pending", "in_progress", "completed"]),
          })
        )
        .optional(),
    }),
    execute: async ({ addTasks, updateTasks }) => {
      const newTodoList: TodoItem[] =
        addTasks?.map((task) => ({
          id: nanoid(),
          task,
          status: "pending",
        })) || [];
      const updatedTodoList: TodoItem[] = state.todoList.map((todo) => {
        const update = updateTasks?.find((t) => t.id === todo.id);
        if (update) {
          return { ...todo, status: update.status };
        }
        return todo;
      });
      state.todoList = [...updatedTodoList, ...newTodoList];
      return { success: true, todoList: state.todoList };
    },
  });
};

const webSearchTool = (_context: AgentContext): Tool => {
  return tool({
    name: "webSearch",
    description: "Search the web for information",
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const results = await exa.search(query);
      return {
        success: true,
        results: results.results.map((result) => ({
          title: result.title,
          url: result.url,
          content: result.text,
        })),
      };
    },
  });
};

const similaritySearchTool = (_context: AgentContext): Tool => {
  return tool({
    name: "similaritySearchKnowledgeBase",
    description:
      "Search the knowledge base for information using similarity search",
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const results = await similaritySearchFile({
        userId: _context.userId,
        query,
        vectorStore: _context.vectorStore,
        folderId: _context.folderId,
        db: _context.db,
      });
      return { success: true, results };
    },
  });
};

const answerFromDocumentTool = (_context: BaseContext): Tool => {
  return tool({
    name: "answerFromKnowledgeBaseDocument",
    description:
      "Answer a question from a document, can even help answer complex multi-step questions",
    inputSchema: z.object({
      documentId: z.string(),
      query: z.string(),
    }),
    execute: async ({ documentId, query }) => {
      const answer = await answerFromPDF({
        messages: query,
        fileId: documentId,
        storage: _context.storage,
        db: _context.db,
        vectorStore: _context.vectorStore,
        streaming: false,
      });
      return { success: true, text: answer.text };
    },
  });
};

const urlLookupTool = (_context: AgentContext): Tool => {
  return tool({
    name: "urlLookup",
    description: "Lookup the information from a URL",
    inputSchema: z.object({
      url: z.string(),
    }),
    execute: async ({ url }) => {
      const response = await exa.getContents([url], { text: true });
      return {
        success: true,
        content: response.results.map((result) => ({
          title: result.title,
          url: result.url,
          content: result.text,
        })),
      };
    },
  });
};

const createArtifactTool = (_context: AgentContext, _state: State): Tool => {
  return tool({
    name: "createResearchReport",
    description: "Create a research report artifact",
    inputSchema: researchReportArtifactSchema,
    execute: async (artifact) => {
      const artifactId = nanoid();
      await _context.db.insert(artifactTable).values([
        {
          id: artifactId,
          userId: _context.userId,
          threadId: _context.threadId,
          artifact: artifact,
        },
      ]);
      return { success: true, artifactId };
    },
  });
};

const readArtifactTool = (_context: AgentContext, _state: State): Tool => {
  return tool({
    name: "readArtifact",
    description: "Read the artifact",
    inputSchema: z.object({
      id: z.string(),
    }),
    execute: async ({ id }) => {
      const artifact = await _context.db.query.artifact.findFirst({
        where: eq(artifactTable.id, id),
      });
      if (!artifact) {
        return { success: false, error: "Artifact not found" };
      }
      return { success: true, artifact: artifact.artifact };
    },
  });
};

const updateArtifactTool = (_context: AgentContext, _state: State): Tool => {
  return tool({
    name: "updateArtifact",
    description: "Update the artifact",
    inputSchema: z.object({
      id: z.string(),
      title: z.string().optional(),
      sectionToUpdate: z
        .object({
          slug: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
        })
        .optional(),
    }),
    execute: async ({ id, title, sectionToUpdate }) => {
      const artifact = await _context.db.query.artifact.findFirst({
        where: and(
          eq(artifactTable.id, id),
          eq(artifactTable.userId, _context.userId),
          eq(artifactTable.threadId, _context.threadId)
        ),
      });
      if (!artifact) {
        return { success: false, error: "Artifact not found" };
      }

      // Update the title if provided
      if (title) {
        artifact.artifact.title = title;
      }

      // Update the section if provided
      if (sectionToUpdate) {
        artifact.artifact.sections = artifact.artifact.sections.map(
          (section) => {
            if (section.slug === sectionToUpdate.slug) {
              return { ...section, ...sectionToUpdate };
            }
            return section;
          }
        );
      }

      await _context.db
        .update(artifactTable)
        .set({
          artifact: artifact.artifact,
        })
        .where(eq(artifactTable.id, id));

      return { success: true, artifactId: id };
    },
  });
};

class MemoryProvider<T extends AgentContext> {
  context: T;
  constructor({ context }: { context: T }) {
    this.context = context;
  }

  async loadMemory() {
    const memoryItem = await this.context.db.query.memory.findFirst({
      where: eq(memory.userId, this.context.userId),
    });
    return memoryItem?.memory || [];
  }

  async updateMemory(memories: Memory[]) {
    await this.context.db
      .insert(memory)
      .values({
        userId: this.context.userId,
        memory: memories,
      })
      .onConflictDoUpdate({
        target: [memory.userId],
        set: {
          memory: memories,
        },
      });
  }
}

export class ThreadMessagesProvider<T extends AgentContext> {
  context: T;
  threadId: string;
  constructor({ context, threadId }: { context: T; threadId: string }) {
    this.context = context;
    this.threadId = threadId;
  }

  async loadMessages(): Promise<UIMessage[]> {
    const messages = await this.context.db.query.message.findMany({
      where: eq(message.threadId, this.threadId),
    });
    return messages
      .map((msg) => msg.message)
      .filter((msg) => msg !== null) as UIMessage[];
  }
  async addMessage(newMessage: UIMessage) {
    const updatedMessages = await this.context.db
      .insert(message)
      .values([
        {
          id: nanoid(),
          threadId: this.threadId,
          message: newMessage,
          createdAt: Date.now(),
        },
      ])
      .onConflictDoUpdate({
        target: [message.id],
        set: {
          message: newMessage,
        },
      })
      .returning();
    return updatedMessages;
  }
}

export class ResearcherAgent<T extends AgentContext> {
  context: T;
  model: AI_MODEL | OPENROUTER_MODEL;
  memoryProvider: MemoryProvider<T>;
  threadMessagesProvider: ThreadMessagesProvider<T>;
  config: {
    includeTodoList: boolean;
    includeMemory: boolean;
    includeWebTools: boolean;
    maxSteps: number;
  };
  baseTools: ToolSet;
  messages: UIMessage[] | undefined;

  constructor({
    context,
    model,
    config,
    threadId,
    tools,
  }: {
    context: T;
    model: AI_MODEL | OPENROUTER_MODEL;
    threadId: string;
    config: {
      includeTodoList: boolean;
      includeMemory: boolean;
      includeWebTools: boolean;
      maxSteps: number;
    };
    tools: (context: T) => ToolSet;
  }) {
    this.context = context;
    this.model = model;
    this.memoryProvider = new MemoryProvider({ context });
    this.threadMessagesProvider = new ThreadMessagesProvider({
      context,
      threadId,
    });
    this.config = config;
    this.baseTools = tools(context);
    if (config.includeWebTools) {
      this.baseTools["webSearch"] = webSearchTool(context);
      this.baseTools["urlLookup"] = urlLookupTool(context);
    }
  }

  getToolsWithState(state: State): ToolSet {
    const tools = { ...this.baseTools };
    if (this.config.includeMemory) {
      tools["updateMemory"] = updateMemoryTool(this.context, state);
    }
    if (this.config.includeTodoList) {
      tools["createTodo"] = createTodoTool(this.context, state);
      tools["updateTodo"] = updateTodoTool(this.context, state);
    }
    // Add artifact tools
    tools["createResearchReport"] = createArtifactTool(this.context, state);
    tools["readArtifact"] = readArtifactTool(this.context, state);
    tools["updateArtifact"] = updateArtifactTool(this.context, state);
    tools["answerFromKnowledgeBaseDocument"] = answerFromDocumentTool(
      this.context
    );
    tools["similaritySearchKnowledgeBase"] = similaritySearchTool(this.context);
    return tools;
  }

  async initializeMessages() {
    if (this.messages) {
      return;
    }
    const messages = await this.threadMessagesProvider.loadMessages();
    this.messages = messages;
  }

  private buildSystemPrompt(state: State): string {
    let prompt = systemPrompt;

    // Add memory context if available
    if (this.config.includeMemory && state.memory.length > 0) {
      prompt += `\n\n## Current Memory\nYou have the following information stored in memory:\n`;
      state.memory.forEach((mem, idx) => {
        prompt += `${idx + 1}. ${mem.details}\n`;
      });
    }

    return prompt;
  }

  async run(message: UIMessage) {
    await this.initializeMessages();
    await this.threadMessagesProvider.addMessage(message);
    const memory = await this.memoryProvider.loadMemory();
    const modelMessages = convertToModelMessages([
      ...(this.messages || []),
      message,
    ]);
    const state: State = {
      messages: this.messages || [],
      todoList: [],
      artifact: null,
      languageModelUsage: [],
      memory,
      updateMemory: this.memoryProvider.updateMemory.bind(this.memoryProvider),
    };

    const response = await generateText({
      model: this.model,
      system: this.buildSystemPrompt(state),
      messages: modelMessages,
      tools: this.getToolsWithState(state),
      experimental_context: state,
      maxRetries: 3,
      stopWhen: stepCountIs(this.config.maxSteps),
    });

    // Save the new message to the database
    const responseMessage: UIMessage = {
      id: nanoid(),
      role: "assistant",
      parts: [
        {
          type: "text",
          text: response.text,
        },
      ],
    };
    await this.threadMessagesProvider.addMessage(responseMessage);

    // Update messages in memory
    this.messages = [...(this.messages || []), message, responseMessage];

    return state;
  }

  async stream(message: UIMessage) {
    await this.initializeMessages();
    await this.threadMessagesProvider.addMessage(message);
    const memory = await this.memoryProvider.loadMemory();
    const modelMessages = convertToModelMessages([
      ...(this.messages || []),
      message,
    ]);
    const state: State = {
      messages: this.messages || [],
      todoList: [],
      artifact: null,
      memory,
      updateMemory: this.memoryProvider.updateMemory.bind(this.memoryProvider),
      languageModelUsage: [],
    };

    const llm = getAILLM(this.model);
    const response = await streamText({
      model: llm,
      system: this.buildSystemPrompt(state),
      messages: modelMessages,
      tools: this.getToolsWithState(state),
      experimental_context: state,
      maxRetries: 3,
      stopWhen: stepCountIs(this.config.maxSteps),
    }).toUIMessageStreamResponse({
      generateMessageId: () => nanoid(),
      onFinish: async ({ responseMessage }) => {
        await this.threadMessagesProvider.addMessage(responseMessage);
        // Update messages in memory
        this.messages = [...(this.messages || []), message, responseMessage];
      },
    });
    return response;
  }
}

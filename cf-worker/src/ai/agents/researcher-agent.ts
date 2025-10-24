import { z } from "zod";
import { UIMessage, tool } from "ai";
import { nanoid } from "nanoid";
import Exa from "exa-js";
import {
  StatefulAgentImpl,
  ThreadAgentContext,
  StatefulAgentConfig,
  MemoryState,
  TodoState,
  ArtifactState,
} from "./core/index";
import {
  MemoryStateManager,
  TodoStateManager,
  ArtifactStateManager,
  MessageStateManager,
} from "./core/state-managers";
import { MetadataToolRegistry, ToolFactory } from "./core/tool-registry";
import { ConfigPresets } from "./core/config";
import { KnowledgeBaseProvider } from "./core/knowledge-provider";

const exa = new Exa(process.env.EXA_API_KEY!);

// Research report artifact schema
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

export type ResearchReportArtifact = z.infer<
  typeof researchReportArtifactSchema
>;

// System prompt
const SYSTEM_PROMPT = `You are an advanced research assistant designed to help users gather, analyze, and synthesize information. You have access to powerful tools that enable you to conduct thorough research, maintain context, manage tasks, and create structured reports.

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

export class ResearcherAgent extends StatefulAgentImpl<ThreadAgentContext> {
  protected override memoryManager: MemoryStateManager;
  protected override todoManager: TodoStateManager;
  protected override artifactManager: ArtifactStateManager;
  protected knowledgeBase: KnowledgeBaseProvider;
  protected messageManager: MessageStateManager;

  constructor(
    context: ThreadAgentContext,
    config: StatefulAgentConfig = ConfigPresets.RESEARCHER
  ) {
    const toolRegistry = new MetadataToolRegistry<ThreadAgentContext>();
    toolRegistry.setContext(context);

    super("ResearcherAgent", config, context, toolRegistry);

    // Get dependencies from context (dependency injection)
    this.memoryManager = context.memoryManager!;
    this.todoManager = context.todoManager!;
    this.artifactManager = context.artifactManager!;
    this.knowledgeBase = context.knowledgeBase!;
    this.messageManager = context.messageManager!;
    this.initializeTools();
  }

  protected initializeTools(): void {
    const config = this.config as StatefulAgentConfig;

    // Memory tools
    if (config.includeMemory) {
      this.registerToolFactory(this.createMemoryToolFactory());
    }

    // Todo tools
    if (config.includeTodoList) {
      this.registerToolFactory(this.createTodoToolFactory());
    }

    // Artifact tools
    if (config.includeArtifacts) {
      this.registerToolFactory(this.createArtifactToolFactory());
    }

    // Web tools
    if (config.includeWebTools) {
      this.registerToolFactory(this.createWebSearchToolFactory());
      this.registerToolFactory(this.createUrlLookupToolFactory());
    }

    // Knowledge base tools
    this.registerToolFactory(this.createSimilaritySearchToolFactory());
    this.registerToolFactory(this.createAnswerFromDocumentToolFactory());
  }

  protected buildSystemPrompt(): string {
    let prompt = SYSTEM_PROMPT;
    const config = this.config as StatefulAgentConfig;

    // Add memory context if available
    if (config.includeMemory) {
      // This would be populated with actual memory data
      prompt += `\n\n## Current Memory\nYou have access to memory tools to store and retrieve information.`;
    }

    return prompt;
  }

  // Tool factories
  private createMemoryToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "updateMemory",
      create: (_context) =>
        tool({
          name: "updateMemory",
          description: "Update the memory with new information",
          inputSchema: z.object({
            updates: z.array(
              z.object({
                id: z.string().optional(),
                details: z.string(),
              })
            ),
            invalidate: z.array(z.string()).optional(),
          }),
          execute: async ({ updates, invalidate }) => {
            const currentMemory = await this.memoryManager.load();

            const newMemory = updates.map(({ id, details }) => {
              const existing = currentMemory.find((m) => m.id === id);
              if (existing) {
                return { ...existing, details, updatedAt: new Date() };
              }
              return {
                id: nanoid(),
                details,
                createdAt: new Date(),
              };
            });

            const invalidatedMemory = currentMemory.filter(
              (m) => !invalidate?.includes(m.id)
            );

            await this.memoryManager.save([...newMemory, ...invalidatedMemory]);
            return { success: true };
          },
        }),
    };
  }

  private createTodoToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "createTodo",
      create: (_context) =>
        tool({
          name: "createTodo",
          description: "Create a new todo item",
          inputSchema: z.object({
            tasks: z.array(z.string()),
          }),
          execute: async ({ tasks }) => {
            const newTodos = await Promise.all(
              tasks.map((task) => this.todoManager.addTodo(task))
            );
            return { success: true, todos: newTodos };
          },
        }),
    };
  }

  private createArtifactToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "createResearchReport",
      create: (_context) =>
        tool({
          name: "createResearchReport",
          description: "Create a research report artifact",
          inputSchema: researchReportArtifactSchema,
          execute: async (artifact) => {
            const artifactState = await this.artifactManager.createArtifact(
              artifact.title,
              artifact,
              "research_report"
            );
            return { success: true, artifactId: artifactState.id };
          },
        }),
    };
  }

  private createWebSearchToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "webSearch",
      create: (_context) =>
        tool({
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
        }),
    };
  }

  private createUrlLookupToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "urlLookup",
      create: (_context) =>
        tool({
          name: "urlLookup",
          description: "Lookup information from a URL",
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
        }),
    };
  }

  private createSimilaritySearchToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "similaritySearchKnowledgeBase",
      create: (_context) =>
        tool({
          name: "similaritySearchKnowledgeBase",
          description: "Search the knowledge base using similarity search",
          inputSchema: z.object({
            query: z.string(),
          }),
          execute: async ({ query }) => {
            const results = await this.knowledgeBase.searchSimilar({
              query,
              userId: this.context.userId,
              folderId: this.context.folderId,
            });
            return { success: true, results };
          },
        }),
    };
  }

  private createAnswerFromDocumentToolFactory(): ToolFactory<ThreadAgentContext> {
    return {
      name: "answerFromKnowledgeBaseDocument",
      create: (_context) =>
        tool({
          name: "answerFromKnowledgeBaseDocument",
          description: "Answer a question from a document",
          inputSchema: z.object({
            documentId: z.string(),
            query: z.string(),
          }),
          execute: async ({ documentId, query }) => {
            const answer = await this.knowledgeBase.answerFromDocument({
              documentId,
              query,
              userId: this.context.userId,
            });
            return { success: true, text: answer.text };
          },
        }),
    };
  }

  // Override getState to include all state managers
  override async getState(): Promise<{
    memory: MemoryState[];
    todos: TodoState[];
    artifacts: ArtifactState[];
  }> {
    const [memory, todos, artifacts] = await Promise.all([
      this.memoryManager.load(),
      this.todoManager.load(),
      this.artifactManager.load(),
    ]);

    return { memory, todos, artifacts };
  }

  override async loadMessages(): Promise<UIMessage[]> {
    return this.messageManager.load();
  }

  // Save message
  override async saveMessage(message: UIMessage): Promise<void> {
    await this.messageManager.save([message]);
  }

  // Explicitly implement stream method for TypeScript
  override async stream(message: UIMessage): Promise<Response> {
    return super.stream(message);
  }
}

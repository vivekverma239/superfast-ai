import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";
import pLimit from "p-limit";
import {
  summarizeChunkWithPages,
  extractDocumentMetadataFromPageSummaries,
  extractTocFromPageSummaries,
  DocumentMetadataSchema,
  TocSchema,
  type BasicPdfParseResult,
} from "@/ai/workflows/parsePdf";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { LanguageModelUsage } from "ai";

export type PDFParsingRuntimeContext = {
  usage: LanguageModelUsage;
};

// Step 1: Extract raw text from PDF
const extractPdfTextStep = createStep({
  id: "extract-pdf-text",
  description: "Extracts raw text from PDF pages",
  inputSchema: z.object({
    pdfUrl: z.string().optional(),
    buffer: z.instanceof(Uint8Array).optional(),
  }),
  outputSchema: z.object({
    totalPages: z.number(),
    rawPages: z.array(
      z.object({
        pageNumber: z.number(),
        content: z.string(),
      })
    ),
  }),
  retries: 3,
  execute: async ({ inputData, runtimeContext }) => {
    let buffer = inputData.buffer;

    if (inputData.pdfUrl) {
      const res = await fetch(inputData.pdfUrl);
      if (!res.ok) {
        throw new Error(
          `Failed to fetch PDF from URL: ${res.status} ${res.statusText}`
        );
      }
      buffer = new Uint8Array(await res.arrayBuffer());
    }

    if (!buffer) {
      throw new Error("Either pdfUrl or buffer must be provided");
    }

    // Load PDF and extract text per page
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pageTexts: string[] = Array.isArray(text)
      ? text
      : [text as unknown as string];

    // Prepare raw page contents
    const rawPages = pageTexts.map((t, idx) => ({
      pageNumber: idx + 1,
      content: t ?? "",
    }));

    return {
      totalPages,
      rawPages,
    };
  },
});

// Step 2: Summarize pages in chunks
const summarizePagesStep = createStep({
  id: "summarize-pages",
  description: "Summarizes pages in 10-page chunks with parallel processing",
  inputSchema: z.object({
    totalPages: z.number(),
    rawPages: z.array(
      z.object({
        pageNumber: z.number(),
        content: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    totalPages: z.number(),
    pageSummaries: z.array(
      z.object({
        pageNumber: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { totalPages, rawPages } = inputData;

    // Group into 10-page chunks
    const limit = pLimit(5);
    const groups: Array<{
      index: number;
      pages: Array<{ pageNumber: number; content: string }>;
      startPage: number;
      endPage: number;
    }> = [];

    for (let i = 0; i < rawPages.length; i += 10) {
      const group = rawPages.slice(i, i + 10);
      const startPage = group[0]?.pageNumber ?? i + 1;
      const endPage =
        group[group.length - 1]?.pageNumber ??
        Math.min(i + 10, rawPages.length);
      groups.push({
        index: Math.floor(i / 10),
        pages: group,
        startPage,
        endPage,
      });
    }

    let count = 0;
    const totalTasks = groups.length;

    // Process chunks in parallel
    const chunkResults = await Promise.all(
      groups.map(({ index, pages }) =>
        limit(async () => {
          const { pages: pageSummaries } = await summarizeChunkWithPages(pages);
          count++;
          console.log(`Summarized chunk ${count}/${totalTasks}`);
          return {
            index,
            pageSummaries,
          };
        })
      )
    );

    // Sort by index and flatten page summaries
    const pageSummaries = chunkResults
      .sort((a, b) => a.index - b.index)
      .flatMap((r) => r.pageSummaries);

    return {
      totalPages,
      pageSummaries,
    };
  },
});

// Step 3: Extract document metadata
const extractMetadataStep = createStep({
  id: "extract-metadata",
  description: "Extracts document-level metadata from page summaries",
  inputSchema: z.object({
    totalPages: z.number(),
    pageSummaries: z.array(
      z.object({
        pageNumber: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })
    ),
  }),
  retries: 3,
  outputSchema: z.object({
    totalPages: z.number(),
    pageSummaries: z.array(
      z.object({
        pageNumber: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })
    ),
    metadata: DocumentMetadataSchema,
  }),
  execute: async ({ inputData }) => {
    const { totalPages, pageSummaries } = inputData;

    const metadata =
      await extractDocumentMetadataFromPageSummaries(pageSummaries);

    return {
      totalPages,
      pageSummaries,
      metadata,
    };
  },
});

// Step 4: Extract table of contents
const extractTocStep = createStep({
  id: "extract-toc",
  description: "Extracts hierarchical table of contents from page summaries",
  inputSchema: z.object({
    totalPages: z.number(),
    pageSummaries: z.array(
      z.object({
        pageNumber: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })
    ),
    metadata: DocumentMetadataSchema,
  }),
  outputSchema: z.object({
    totalPages: z.number(),
    pages: z.array(
      z.object({
        pageNumber: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })
    ),
    metadata: DocumentMetadataSchema,
    toc: TocSchema,
  }),
  retries: 3,
  execute: async ({ inputData }) => {
    const { totalPages, pageSummaries, metadata } = inputData;

    const toc = await extractTocFromPageSummaries(pageSummaries);

    return {
      totalPages,
      pages: pageSummaries,
      metadata,
      toc,
    };
  },
});

// Create the PDF parsing workflow
export const pdfParsingWorkflow = createWorkflow({
  id: "pdf-parsing-workflow",
  inputSchema: z.object({
    pdfUrl: z.string().optional(),
    buffer: z.instanceof(Uint8Array).optional(),
  }),
  outputSchema: z.object({
    totalPages: z.number(),
    pages: z.array(
      z.object({
        pageNumber: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })
    ),
    metadata: DocumentMetadataSchema,
    toc: TocSchema,
  }),
})
  .then(extractPdfTextStep)
  .then(summarizePagesStep)
  .parallel([extractMetadataStep, extractTocStep])
  .commit();

// Export a helper function to run the workflow
export async function parsePdfWithWorkflow(
  pdfUrl?: string,
  buffer?: Uint8Array
): Promise<BasicPdfParseResult> {
  const run = await pdfParsingWorkflow.createRunAsync();
  const runtimeContext = new RuntimeContext<PDFParsingRuntimeContext>();
  const result = await run.start({
    inputData: {
      pdfUrl,
      buffer: buffer as Uint8Array<ArrayBuffer> | undefined,
    },
  });

  if (result.status === "failed") {
    throw result.error;
  }

  if (result.status === "suspended") {
    throw new Error("Workflow was suspended unexpectedly");
  }

  return result.result;
}

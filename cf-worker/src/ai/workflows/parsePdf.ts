"use node";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { generateTextWrapper, generateObjectWrapper } from "../aisdk";
import type { ModelMessage } from "ai";
import pLimit from "p-limit";
import { AI_MODEL, OPENROUTER_MODEL } from "@/ai/aisdk";
import { extractPageContent } from "@/utils/pdf";
import _ from "lodash";
import { runWithTokenTracker } from "@/utils/tokenTracker";

export type PageParseResult = {
  pageNumber: number;
  content: string;
  summary: string;
  keyPoints: string[];
};

export type ChunkPageSummary = {
  pageNumber: number;
  summary: string;
  keyPoints: string[];
};

export type ChunkParseResult = {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  content: string; // XML formatted content
  summary: string;
  keyPoints: string[];
  pageSummaries: ChunkPageSummary[];
};

export type DocumentMetadata = {
  title: string;
  shortSummary: string;
  summary: string;
  publishedDate?: string;
  publisher?: string;
  authors?: string[];
  language?: string;
  keywords?: string[];
  entities?: {
    persons?: string[];
    organizations?: string[];
    locations?: string[];
    dates?: string[];
  };
  categories?: string[];
  docType?: string;
};

// Added: TOC types
export type TocSubsection = {
  title: string;
  pageStart: number;
  pageEnd: number;
  summary: string; // very short (<= 2 sentences)
};

export type TocSection = {
  title: string;
  pageStart: number;
  pageEnd: number;
  summary: string; // very short (<= 2 sentences)
  subsections: TocSubsection[];
};

export type Toc = {
  sections: TocSection[];
};

export type BasicPdfParseResult = {
  totalPages: number;
  pages: ChunkPageSummary[];
  metadata: DocumentMetadata;
  toc: Toc; // Added
};

const ChunkSummarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).max(50),
  pages: z
    .array(
      z.object({
        pageNumber: z.number().int().nonnegative(),
        summary: z.string(),
        keyPoints: z.array(z.string()).max(30),
      })
    )
    .min(1),
});

export const DocumentMetadataSchema = z.object({
  title: z.string(),
  shortSummary: z.string(),
  summary: z.string(),
  publishedDate: z.string().optional(),
  entities: z
    .object({
      persons: z.array(z.string()).optional(),
      organizations: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      dates: z.array(z.string()).optional(),
    })
    .optional(),
  docType: z.string().optional(),
});

// Added: TOC schemas
const TocSubsectionSchema = z.object({
  title: z.string(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  summary: z.string(),
});

const TocSectionSchema = z.object({
  title: z.string(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  summary: z.string(),
  subsections: z.array(TocSubsectionSchema),
});

export const TocSchema = z.object({
  sections: z.array(TocSectionSchema),
});

export function parseJsonFromText<T = unknown>(text: string): T | null {
  try {
    const fenceMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i);
    const jsonCandidate = fenceMatch ? fenceMatch[1] : text;

    const start = jsonCandidate?.indexOf("{");
    const end = jsonCandidate?.lastIndexOf("}");
    const slice =
      start !== -1 && end !== undefined && end !== -1
        ? jsonCandidate?.slice(start, end + 1)
        : jsonCandidate;
    return JSON.parse(slice ?? "{}") as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function summarizeChunkWithPages(
  pages: Array<{ pageNumber: number; content: string }>
): Promise<{
  summary: string;
  keyPoints: string[];
  pages: ChunkPageSummary[];
  xml: string;
}> {
  // Build XML input so the model can clearly map summaries to page numbers
  const xml = [
    "<chunk>",
    ...pages.map(
      (p) =>
        `<page number="${p.pageNumber}"><![CDATA[\n${p.content}\n]]></page>`
    ),
    "</chunk>",
  ].join("\n");

  const messages: ModelMessage[] = [
    {
      role: "system",
      content:
        "You are an expert technical writer. Read an XML chunk consisting of multiple pages. For EACH page, produce a concise yet detailed summary and key points. Also produce an overall chunk summary and key points. Ensure pageNumber in the output matches the number attribute in the <page> node. Return ONLY a valid JSON object matching the schema.",
    },
    {
      role: "user",
      content: `Parse this XML and return JSON matching the schema below as pure JSON text. Do not include any extra commentary. Use the <page number> attribute to set pageNumber exactly.\n\nSchema (TypeScript):\n{ summary: string; keyPoints: string[]; pages: Array<{ pageNumber: number; summary: string; keyPoints: string[] }>; }\n\nXML:\n${xml}`,
    },
  ];

  const gen = await generateTextWrapper({
    model: OPENROUTER_MODEL.GPT_OSS_120B,
    messages,
    systemPrompt: "",
    reasoningLevel: "none",
  });

  if (gen.isOk()) {
    const text = gen.value?.text ?? "";
    const parsed = parseJsonFromText<{
      summary: string;
      keyPoints: string[];
      pages: ChunkPageSummary[];
    }>(text);
    if (parsed) {
      const safe = ChunkSummarySchema.safeParse(parsed);
      if (safe.success) {
        return {
          summary: safe.data.summary,
          keyPoints: safe.data.keyPoints,
          pages: safe.data.pages,
          xml,
        };
      }
    }
  }
  // Fallback if object generation fails
  return {
    summary: pages
      .map((p) => p.content)
      .join("\n\n")
      .slice(0, 1200),
    keyPoints: [],
    pages: pages.map((p) => ({
      pageNumber: p.pageNumber,
      summary: "",
      keyPoints: [],
    })),
    xml,
  };
}

export async function summarizeChunkWithPagesStructured(
  pages: Array<{ pageNumber: number; content: string }>
): Promise<{
  summary: string;
  keyPoints: string[];
  pages: ChunkPageSummary[];
  xml: string;
}> {
  const xml = [
    "<chunk>",
    ...pages.map(
      (p) =>
        `<page number="${p.pageNumber}"><![CDATA[\n${p.content}\n]]></page>`
    ),
    "</chunk>",
  ].join("\n");

  const messages: ModelMessage[] = [
    {
      role: "system",
      content:
        "You are an expert technical writer. Read an XML chunk consisting of multiple pages. For EACH page, produce a concise yet detailed summary and key points. Also produce an overall chunk summary and key points. Ensure pageNumber in the output matches the number attribute in the <page> node.",
    },
    {
      role: "user",
      content: `Return JSON matching: { summary: string; keyPoints: string[]; pages: Array<{ pageNumber: number; summary: string; keyPoints: string[] }>; }\nUse the <page number> attribute for pageNumber.\n\nXML:\n${xml}`,
    },
  ];

  let retryCount = 0;
  while (retryCount < 3) {
    try {
      const result = await generateObjectWrapper<{
        summary: string;
        keyPoints: string[];
        pages: ChunkPageSummary[];
      }>({
        model: OPENROUTER_MODEL.GROK_4_FAST,
        messages,
        schema: ChunkSummarySchema,
        reasoningLevel: "none",
      });

      if (result.isOk()) {
        const value = result.value;
        return {
          summary: value.summary,
          keyPoints: value.keyPoints,
          pages: value.pages,
          xml,
        };
      }
      return {
        summary: pages
          .map((p) => p.content)
          .join("\n\n")
          .slice(0, 1200),
        keyPoints: [],
        pages: pages.map((p) => ({
          pageNumber: p.pageNumber,
          summary: "",
          keyPoints: [],
        })),
        xml,
      };
    } catch (error) {
      console.error(error);
      retryCount++;
      if (retryCount === 3) {
        throw error;
      }
    }
  }
  throw new Error("Failed to summarize chunk with pages");
}

export async function summarizePages(
  pageTexts: Array<{ pageNumber: number; content: string }>
): Promise<ChunkPageSummary[]> {
  const batchSize = 10;
  const batches = _.chunk(pageTexts, batchSize);
  const limit = pLimit(10);

  const chunkOutputs = await Promise.all(
    batches.map((batch) =>
      limit(async () => summarizeChunkWithPagesStructured(batch))
    )
  );
  const pageSummaries = chunkOutputs
    .flatMap((output) => output.pages)
    .sort((a, b) => a.pageNumber - b.pageNumber);
  return pageSummaries;
}

export async function extractDocumentMetadataFromPageSummaries(
  pageSummaries: ChunkPageSummary[]
): Promise<DocumentMetadata> {
  const limit = pLimit(5);
  const batches = _.chunk(pageSummaries, 50);
  const tasks = [] as Promise<
    | {
        startPage: number;
        endPage: number;
        metadata: DocumentMetadata;
      }
    | undefined
  >[];
  let done = 0;
  for (const batch of batches) {
    tasks.push(
      limit(async () => {
        const chunkSynopsis = batch
          .map(
            (c) =>
              `Page ${c.pageNumber}:\nSummary: ${
                c.summary
              }\nKeyPoints: ${c.keyPoints.join(", ")}`
          )
          .join("\n\n");

        const messages: ModelMessage[] = [
          {
            role: "system",
            content:
              "You are an expert librarian. Infer document-level metadata from chunk summaries and the first pages. Do NOT hallucinate; if a field is unknown, leave it empty or omit it. Return ONLY JSON.",
          },
          {
            role: "user",
            content: `Provide document metadata with the following fields: \n- title (string)\n- shortSummary (string)\n- summary (string, detailed)\n- publishedDate (string, ISO if possible)\n- publisher (string)\n- authors (string[])\n- language (string)\n- keywords (string[])\n- entities: { persons: string[], organizations: string[], locations: string[], dates: string[] }\n- categories (string[])\n- docType (string)\n\nChunk Summaries:\n${chunkSynopsis}\n\nHead Pages ( summaries):\n\nReturn pure JSON only.`,
          },
        ];

        const gen = await generateTextWrapper({
          model: OPENROUTER_MODEL.GPT_OSS_120B,
          messages,
          systemPrompt: "",
          reasoningLevel: "none",
        });

        if (gen.isOk()) {
          const text = gen.value?.text ?? "";
          const parsed = parseJsonFromText<DocumentMetadata>(text);
          if (parsed) {
            const safe = DocumentMetadataSchema.safeParse(parsed);
            if (safe.success) {
              return {
                startPage: batch[0]?.pageNumber ?? 0,
                endPage: batch[batch.length - 1]?.pageNumber ?? 0,
                metadata: safe.data,
              };
            } else {
              console.error(
                `Failed to parse document metadata from page summaries: ${text} ${safe.error}`
              );
            }
            done++;
            console.log(`Completed task ${done}/${batches.length}`);
          } else {
            console.error(
              `Failed to parse document metadata from page summaries: ${text}`
            );
          }
        } else {
          console.error(
            "Failed to extract document metadata from page summaries",
            gen.error
          );
        }
      })
    );
  }
  const results = await Promise.all(tasks);
  if (results.length === 1) {
    return results[0]!.metadata;
  }

  const messages: ModelMessage[] = [
    {
      role: "system",
      content:
        "You are an expert librarian. You have given a list of metadata which is extracted from chunks of document, your task is to consolidate them into a single metadata object. Return ONLY JSON.",
    },
    {
      role: "user",
      content: results
        .filter((t) => t !== undefined)
        .map(
          (t) => `
        Page Range ${t?.startPage}-${t?.endPage}:\nSummary: ${
          t?.metadata.summary
        }\n\n
        Metadata:\n${JSON.stringify(t?.metadata)}\n\n`
        )
        .join("\n"),
    },
  ];

  const gen = await generateObjectWrapper<DocumentMetadata>({
    model: AI_MODEL.GEMINI_2_5_FLASH_LITE,
    messages,
    schema: DocumentMetadataSchema,
    reasoningLevel: "none",
  });

  if (gen.isOk()) {
    const value = gen.value;
    return value;
  }

  throw new Error("Failed to extract document metadata");
}

// Added: TOC extraction from chunks
export async function extractTocFromPageSummaries(
  pageSummaries: ChunkPageSummary[]
): Promise<Toc> {
  if (pageSummaries.length === 0) {
    throw new Error("No page summaries available to extract TOC");
  }

  const BATCH_SIZE = 50;
  let count = 0;
  const totalTasks = Math.ceil(pageSummaries.length / BATCH_SIZE);
  const batches = _.chunk(pageSummaries, BATCH_SIZE);

  // Helper to build synopsis for a batch
  function buildBatchSynopsis(
    batch: Array<{ pageNumber: number; summary: string }>
  ): string {
    const start = batch[0]?.pageNumber ?? 1;
    const end = batch[batch.length - 1]?.pageNumber ?? start;
    const lines = [`Pages ${start}-${end}`];
    for (const p of batch) {
      lines.push(`  - page ${p.pageNumber}: ${p.summary}`);
    }
    return lines.join("\n");
  }

  // Ask the model for each batch
  const partialTocs: Toc[] = [];
  const limit = pLimit(5);
  const tasks = [] as Promise<void>[];
  for (const batch of batches) {
    tasks.push(
      limit(async () => {
        const synopsis = buildBatchSynopsis(batch);

        const messages: ModelMessage[] = [
          {
            role: "system",
            content:
              "You are a document analyst. Build a hierarchical Table of Contents (TOC) with sections and subsections from a synopsis of page-level summaries within a page range. Sections may span multiple pages in the range. Keep summaries very short (<= 2 sentences). Ensure page ranges are accurate and inclusive.",
          },
          {
            role: "user",
            content: `Given the following page-range synopsis, create a TOC JSON grouping content into sections and subsections. Use absolute page numbers from the synopsis.\n\n
        \n\nSynopsis:\n${synopsis}`,
          },
        ];

        const result = await generateObjectWrapper<Toc>({
          model: OPENROUTER_MODEL.GROK_4_FAST,
          messages,
          schema: TocSchema,
          reasoningLevel: "none",
        });

        if (!result.isOk()) {
          console.log("Failed to extract partial TOC for batch", result.error);
          throw new Error("Failed to extract TOC from chunks");
        }
        count++;
        console.log(`Completed task ${count}/${totalTasks}`);
        partialTocs.push(result.value);
      })
    );
  }
  await Promise.all(tasks);

  // Combine partial TOCs by flattening and merging adjacent sections with same title and contiguous ranges
  function mergeSections(sections: TocSection[]): TocSection[] {
    if (sections.length === 0) return sections;
    const sortedSections = [...sections].sort(
      (a, b) => a.pageStart - b.pageStart
    );
    const merged: TocSection[] = [];

    function mergeSubsections(
      a: TocSubsection[],
      b: TocSubsection[]
    ): TocSubsection[] {
      const combined = [...a, ...b].sort((x, y) => x.pageStart - y.pageStart);
      const out: TocSubsection[] = [];
      for (const s of combined) {
        const last = out[out.length - 1];
        if (last && last.title === s.title && last.pageEnd + 1 >= s.pageStart) {
          last.pageEnd = Math.max(last.pageEnd, s.pageEnd);
          // Keep the shorter summary to stay concise
          if ((s.summary?.length ?? 0) < (last.summary?.length ?? 0)) {
            last.summary = s.summary;
          }
        } else {
          out.push({ ...s });
        }
      }
      return out;
    }

    for (const s of sortedSections) {
      const last = merged[merged.length - 1];
      if (last && last.title === s.title && last.pageEnd + 1 >= s.pageStart) {
        last.pageEnd = Math.max(last.pageEnd, s.pageEnd);
        // Prefer shorter summary
        if ((s.summary?.length ?? 0) < (last.summary?.length ?? 0)) {
          last.summary = s.summary;
        }
        last.subsections = mergeSubsections(last.subsections, s.subsections);
      } else {
        merged.push({ ...s, subsections: [...s.subsections] });
      }
    }
    return merged;
  }

  const combinedSections = mergeSections(
    partialTocs.flatMap((pt) => pt.sections)
  );

  return { sections: combinedSections };
}

export async function parseBasicPDF(
  pdfUrl: string | undefined,
  buffer: Uint8Array | undefined
): Promise<BasicPdfParseResult> {
  if (pdfUrl) {
    const res = await fetch(pdfUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch PDF from URL: ${res.status} ${res.statusText}`
      );
    }
    buffer = new Uint8Array(await res.arrayBuffer());
  }

  // Load PDF and extract text per page
  const pdf = await getDocumentProxy(buffer);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts: string[] = Array.isArray(text)
    ? text
    : [text as unknown as string];

  // Prepare raw page contents
  const rawPages: Array<{ pageNumber: number; content: string }> =
    pageTexts.map((t, idx) => ({ pageNumber: idx + 1, content: t ?? "" }));

  // Group into 10-page chunks and summarize in parallel with concurrency limit
  const pageSummaryMap = new Map<
    number,
    { summary: string; keyPoints: string[] }
  >();
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
      group[group.length - 1]?.pageNumber ?? Math.min(i + 10, rawPages.length);
    groups.push({
      index: Math.floor(i / 10),
      pages: group,
      startPage,
      endPage,
    });
  }

  let count = 0;
  const totalTasks = groups.length;

  const chunkResults = await Promise.all(
    groups.map(({ index, pages, startPage, endPage }) =>
      limit(async () => {
        const {
          summary,
          keyPoints,
          pages: pageSummaries,
          xml,
        } = await summarizeChunkWithPages(pages);
        count++;
        console.log(`Completed task ${count}/${totalTasks}`);
        return {
          index,
          startPage,
          endPage,
          summary,
          keyPoints,
          pageSummaries,
          xml,
        };
      })
    )
  );

  // Sort by index and build chunks
  const chunks: ChunkParseResult[] = chunkResults
    .sort((a, b) => a.index - b.index)
    .map(
      ({
        index,
        startPage,
        endPage,
        summary,
        keyPoints,
        pageSummaries,
        xml,
      }) => {
        // Record per-page summaries
        for (const p of pageSummaries) {
          pageSummaryMap.set(p.pageNumber, {
            summary: p.summary,
            keyPoints: p.keyPoints,
          });
        }
        return {
          chunkIndex: index,
          startPage,
          endPage,
          content: xml,
          summary,
          keyPoints,
          pageSummaries,
        } satisfies ChunkParseResult;
      }
    );

  // Build final pages array, merging content with summaries derived from chunk parsing
  const pages: PageParseResult[] = rawPages.map(({ pageNumber, content }) => {
    const ps = pageSummaryMap.get(pageNumber);
    return {
      pageNumber,
      content,
      summary: ps?.summary ?? "",
      keyPoints: ps?.keyPoints ?? [],
    };
  });

  const pageSummaries = chunks.map((c) => c.pageSummaries).flat();
  const metadata =
    await extractDocumentMetadataFromPageSummaries(pageSummaries);
  // Added: extract TOC
  const toc = await extractTocFromPageSummaries(pageSummaries);

  return { totalPages, pages, metadata, toc };
}

async function _parseBasicPDFStructured(
  pdfUrl: string | undefined,
  buffer: Uint8Array | undefined
): Promise<BasicPdfParseResult> {
  if (pdfUrl) {
    const res = await fetch(pdfUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch PDF from URL: ${res.status} ${res.statusText}`
      );
    }
    buffer = new Uint8Array(await res.arrayBuffer());
  }

  if (!buffer) {
    throw new Error("Buffer is required");
  }

  const pageTexts = await extractPageContent(buffer);

  const pageSummaries = await summarizePages(pageTexts);
  const metadata =
    await extractDocumentMetadataFromPageSummaries(pageSummaries);
  // Added: extract TOC
  const toc = await extractTocFromPageSummaries(pageSummaries);

  return {
    totalPages: pageTexts.length,
    pages: pageSummaries,
    metadata,
    toc,
  };
}

export const parseBasicPDFStructured = async (
  pdfUrl: string | undefined,
  buffer: Uint8Array | undefined
) => runWithTokenTracker(_parseBasicPDFStructured, pdfUrl, buffer);

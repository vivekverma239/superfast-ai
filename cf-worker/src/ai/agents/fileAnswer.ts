import { FilePart, tool } from "ai";
import { generateTextWrapper, getAILLM } from "../aisdk";
import { AI_MODEL, OPENROUTER_MODEL } from "@/ai/aisdk";
import _ from "lodash";
import { z } from "zod";
import { runWithTokenTracker } from "@/utils/tokenTracker";
import { createSubPdf } from "@/utils/pdf";
import { Toc } from "../workflows/parsePdf";
import { BaseAgent } from "./base";
import { Database } from "@/db";
import { Storage } from "@/storage";
import { VectorStore } from "@/vector-store";
export const answerFromPDF = async (
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number,
  query: string
) => {
  console.log(
    `Answering from PDF from page ${startPage} to ${endPage}, query: ${query}`
  );
  //   const pages = await extractImage(pdfBuffer, _.range(startPage, endPage + 1));
  const subPDF = await createSubPdf(pdfBuffer, _.range(startPage, endPage + 1));
  const prompt = `
You are a helpful PDF analysis assistant. Your task is to analyze the provided PDF pages and answer the user's query with detailed, accurate information.

CRITICAL REQUIREMENTS:
1. ONLY use information from the provided PDF pages - do not make up or infer any information not explicitly shown
2. ALWAYS cite specific page numbers for every piece of information you reference
3. Be thorough and detailed in your analysis
4. If information spans multiple pages, mention all relevant page numbers
5. If you cannot find information to answer the query, clearly state this and explain what information is available

RESPONSE FORMAT:
- Start with a brief summary of what you found
- Provide detailed answers with specific page citations
- Use format: "According to page X..." or "As shown on page Y..."
- If referencing multiple pages: "Pages X-Y show..."
- End with a summary of key findings

Query: ${query}

Answer:
`;
  const answer = await generateTextWrapper({
    model: AI_MODEL.GEMINI_2_5_FLASH_LITE,
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `ANALYZING PAGES ${startPage} to ${endPage} of the PDF document. Each page is provided as an image below with its corresponding page number. Please analyze all pages carefully and cite specific page numbers in your response.

Page mapping:
${_.range(startPage, endPage + 1)
  .map((page) => `- Page ${page}`)
  .join("\n")}`,
          },
          {
            type: "file",
            data: subPDF,
            mediaType: "application/pdf",
          } as FilePart,
          {
            type: "text",
            text: `USER QUERY: ${query}

Please provide a comprehensive answer based on the PDF pages above, ensuring you cite specific page numbers for all information referenced.`,
          },
        ],
      },
    ],
    systemPrompt: prompt,
    reasoningLevel: "none",
  });
  if (answer.isErr()) {
    console.error(answer.error);
    throw new Error("Failed to answer from pdf");
  }
  console.log({
    usage: answer.value.usage,
  });
  return answer.value.text;
};

export const answerFromPDFTool = (pdfBuffer: Buffer) => {
  return tool({
    name: "answerFromPDF",
    description:
      "Analyze specific PDF pages to answer queries. Returns detailed responses with page number citations. Use this tool to examine relevant page ranges based on the table of contents.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The specific question or query to answer from the PDF pages"
        ),
      startPage: z
        .number()
        .describe("The starting page number to analyze (inclusive)"),
      endPage: z
        .number()
        .describe("The ending page number to analyze (inclusive)"),
    }),
    execute: async ({ query, startPage, endPage }) => {
      return await answerFromPDF(pdfBuffer, startPage, endPage, query);
    },
  });
};

const _answerFromPDFWithTOC = async (
  fileId: string,
  pdfBuffer: Buffer,
  toc: Toc,
  query: string
) => {
  const systemPrompt = `
You are a helpful PDF analysis assistant with access to a table of contents and PDF content analysis tools.

Your task is to:
1. Analyze the table of contents to identify the most relevant sections for the user's query
2. Use the answerFromPDF tool to examine specific page ranges that contain relevant information
3. Synthesize information from multiple sections if needed
4. Always ensure page number citations are included in your final response

CRITICAL REQUIREMENTS:
- ALWAYS cite specific page numbers for every piece of information
- Use the answerFromPDF tool to examine relevant sections based on the TOC
- If information spans multiple sections, examine each relevant section
- Provide comprehensive answers with proper page references
- If you cannot find relevant information, clearly state this
- Do not directly answer from the table of contents, always use the answerFromPDF tool to examine relevant sections

Table of Contents:
${JSON.stringify(toc, null, 2)}


File ID: ${fileId}

When using the answerFromPDF tool:
- Choose appropriate page ranges based on the TOC structure
- Be specific about which sections to examine
- Always request page number citations in the tool responses
- Try to answer in 3-4 calls, don't overuse the tool
- Try to pass at max 10 pages to the answerFromPDF tool
- Make sure to add citations in the following format and make sure to add it in all relevant places
- [fileID/pageNumber]
Example:
 Total stock-based compensation expense recognized was **$16.4 million** for the year ended December 31, 2024 [file_1234/12] [file_1234/77]
`;

  const answer = await generateTextWrapper({
    model: OPENROUTER_MODEL.GROK_4_FAST,
    // model: AI_MODEL.GEMINI_2_5_FLASH,

    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    tools: {
      answerFromPDF: answerFromPDFTool(pdfBuffer),
    },
    systemPrompt: systemPrompt,
    reasoningLevel: "default",
  });
  if (answer.isErr()) {
    console.error(answer.error);
    throw new Error("Failed to answer from pdf");
  }
  return answer.value.text;
};

export const answerFromPDFWithTOC = async ({
  fileId,
  pdfBuffer,
  toc,
  query,
}: {
  fileId: string;
  pdfBuffer: Buffer;
  toc: Toc;
  query: string;
}) => {
  return await runWithTokenTracker(
    _answerFromPDFWithTOC,
    fileId,
    pdfBuffer,
    toc,
    query
  );
};

export type PDFAgentContext = {
  db: Database;
  storage: Storage;
  vectorStore: VectorStore;
  fileId: string;
  fileBuffer: Buffer;
  toc: Toc;
  threadId?: string;
  folderId?: string;
};

export const PDFAnswerAgent = new BaseAgent<PDFAgentContext>({
  name: "PDFAnswerAgent",
  model: OPENROUTER_MODEL.GROK_4_FAST,
  instructions: (context) => `
  You are a helpful PDF analysis assistant with access to a table of contents and PDF content analysis tools.

  Your task is to:
  1. Analyze the table of contents to identify the most relevant sections for the user's query
  2. Use the answerFromPDF tool to examine specific page ranges that contain relevant information
  3. Synthesize information from multiple sections if needed
  4. Always ensure page number citations are included in your final response

  CRITICAL REQUIREMENTS:
  - ALWAYS cite specific page numbers for every piece of information
  - Use the answerFromPDF tool to examine relevant sections based on the TOC
  - If information spans multiple sections, examine each relevant section
  - Provide comprehensive answers with proper page references
  - If you cannot find relevant information, clearly state this
  - Do not directly answer from the table of contents, always use the answerFromPDF tool to examine relevant sections

  Table of Contents:
  ${JSON.stringify(context.toc, null, 2)}


  File ID: ${context.fileId}

  When using the answerFromPDF tool:
  - Choose appropriate page ranges based on the TOC structure
  - Be specific about which sections to examine
  - Always request page number citations in the tool responses
  - Try to answer in 3-4 calls, don't overuse the tool
  - Try to pass at max 10 pages to the answerFromPDF tool
  - Make sure to add citations in the following format and make sure to add it in all relevant places
  - [fileID/pageNumber]
  Example:
   Total stock-based compensation expense recognized was **$16.4 million** for the year ended December 31, 2024 [file_1234/12] [file_1234/77]
  `,
  tools: (context) => {
    return {
      answerFromPDF: answerFromPDFTool(context.fileBuffer),
    };
  },
});

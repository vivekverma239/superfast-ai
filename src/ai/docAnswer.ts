import { AI_MODEL, OPENROUTER_MODEL } from './models';
import { FilePart, generateText, ImagePart, TextPart, Tool, tool, ToolSet } from 'ai';
import { generateTextWrapper, getAILLM } from './aisdk';
import { getUsageContextRunner } from '../utils/usageAsyncContext';
import z from 'zod';
import { TocSection } from './parseDoc';

const SYSTEM_PROMPT = `
You are an helpful assistant, your job is to look at the provided pages from a pdf document and answer the given query. 

Follow these guidelines:
- Be accurate and descriptive while answering the query.
- DO NOT USE YOUR OWN KNOWLEDGE, ONLY USE THE INFORMATION FROM THE PROVIDED PAGES.
- Use appropirate inline citations to denote which pages are being used to support the answer.

Citation format: 
 - Use following format for inline citations:
  [page_{number}] where {number} is the page number of the page being referenced.
  For Example: 
   Apple revenue of Q3 2024 was $100 billion [page_23].
`;

type PageUrl = {
	pageNumber: number;
	url: string | Buffer;
};

export const quickAnswer = async ({
	query,
	documentTitle,
	documentSummary,
	pages,
}: {
	query: string;
	documentTitle: string;
	documentSummary: string;
	pages: PageUrl[];
}) => {
	console.log(`Quick answer Called: ${query}, ${documentTitle}, ${pages}`);
	const start = performance.now();
	const parts: (TextPart | ImagePart)[] = [
		{
			type: 'text',
			text: `Query: ${query}
The following pages are from the pdf document:
Document Title: ${documentTitle}
Document Summary: ${documentSummary}

`,
		},
	];

	for (const p of pages) {
		parts.push({
			type: 'text',
			text: `Page number: ${p.pageNumber}`,
		} as TextPart);
		parts.push({
			type: 'image',
			image: p.url,
			mediaType: 'image/png',
		} as ImagePart);
	}

	const response = await generateTextWrapper({
		model: OPENROUTER_MODEL.GROK_4_FAST,
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{
				role: 'user',
				content: parts,
			},
		],
		reasoningLevel: 'default',
		systemPrompt: SYSTEM_PROMPT,
	});

	const end = performance.now();
	console.log(`Quick answer time: ${end - start} milliseconds`);
	return response;
};

export const quickAnswerV2 = async ({
	query,
	documentTitle,
	documentSummary,
	pageNumbers,
	subPDF,
}: {
	query: string;
	documentTitle: string;
	documentSummary: string;
	pageNumbers: number[];
	subPDF: Buffer;
}) => {
	console.log(`Quick answer Called : v2 ${query}, ${documentTitle}`);
	const start = performance.now();
	const parts: (TextPart | FilePart)[] = [
		{
			type: 'text',
			text: `Query: ${query}
The following pages are from the pdf document:
Page Numbers: ${pageNumbers}
Document Title: ${documentTitle}
Document Summary: ${documentSummary}

`,
		},
		{
			type: 'file',
			data: subPDF,
			mediaType: 'application/pdf',
		} as FilePart,
	];

	const response = await generateTextWrapper({
		model: AI_MODEL.GEMINI_2_5_FLASH_LITE_LATEST,
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{
				role: 'user',
				content: parts,
			},
		],
		reasoningLevel: 'default',
		systemPrompt: SYSTEM_PROMPT,
	});

	const end = performance.now();
	console.log(`Quick answer V2 time: ${end - start} milliseconds`);
	return response;
};

const subPDFAnswerTool = (documentTitle: string, documentSummary: string, getPagesFn: (pages: number[]) => Promise<PageUrl[]>) => {
	return tool({
		name: 'subPDFAnswer',
		description: 'Answer a question about a sub-section of a pdf document',
		inputSchema: z.object({
			query: z.string(),
			pages: z.array(z.number()),
		}),
		execute: async ({ query, pages }) => {
			const runInScope = getUsageContextRunner();
			return await runInScope(async () => {
				const pagesUrl = await getPagesFn(pages);
				const response = await quickAnswer({
					query,
					documentTitle,
					documentSummary,
					pages: pagesUrl,
				});
				if (response.isErr()) {
					return 'Error';
				}
				console.log(`Quick answer V2 response: ${response.value?.text}`);
				console.log(`Usage: ${response.value?.usage}`);
				return response.value?.text;
			});
		},
	});
};

const subPDFAnswerToolV2 = (documentTitle: string, documentSummary: string, getSubPDFFn: (pages: number[]) => Promise<Buffer>) => {
	return tool({
		name: 'subPDFAnswer',
		description: 'Answer a question about a sub-section of a pdf document',
		inputSchema: z.object({
			query: z.string(),
			pages: z.array(z.number()),
		}),
		execute: async ({ query, pages }) => {
			const runInScope = getUsageContextRunner();
			return await runInScope(async () => {
				const pagesUrl = await getSubPDFFn(pages);
				const response = await quickAnswerV2({
					query,
					documentTitle,
					documentSummary,
					subPDF: pagesUrl,
					pageNumbers: pages,
				});
				if (response.isErr()) {
					return 'Error';
				}
				console.log(`Quick answer V2 response: ${response.value?.text}`);
				console.log(`Usage: ${response.value?.usage}`);
				return response.value?.text;
			});
		},
	});
};

const DocumentAnswerPrompt = `
You are an helpful assistant, your job is to look at the table of content and prepare a response to 
user query, but finding the relevant pages and answering the questions using the 'subPDFAnswer' tool.

You should use the 'subPDFAnswer' tool to answer the question.


`;

export const getAnswerFromDoc = async ({
	query,
	documentTitle,
	documentSummary,
	toc,
	getPagesFn,
}: {
	query: string;
	documentTitle: string;
	documentSummary: string;
	toc: TocSection[];
	getPagesFn: (pages: number[]) => Promise<PageUrl[]>;
}) => {
	const tools: ToolSet = {
		subPDFAnswer: subPDFAnswerTool(documentTitle, documentSummary, getPagesFn),
	};

	const response = await generateTextWrapper({
		model: OPENROUTER_MODEL.GROK_4_FAST,
		messages: [
			{ role: 'system', content: DocumentAnswerPrompt },
			{
				role: 'user',
				content: `
                User Query: ${query}
                Document Title: ${documentTitle}
                Document Summary: ${documentSummary}
                Table of Content: ${JSON.stringify(toc)}
                `,
			},
		],
		systemPrompt: DocumentAnswerPrompt,
		reasoningLevel: 'default',
		tools,
	});
	return response;
};

export const getAnswerFromDocV2 = async ({
	query,
	documentTitle,
	documentSummary,
	toc,
	getSubPDFFn,
}: {
	query: string;
	documentTitle: string;
	documentSummary: string;
	toc: TocSection[];
	getSubPDFFn: (pages: number[]) => Promise<Buffer>;
}) => {
	const tools: ToolSet = {
		subPDFAnswer: subPDFAnswerToolV2(documentTitle, documentSummary, getSubPDFFn),
	};

	const response = await generateTextWrapper({
		model: OPENROUTER_MODEL.GROK_4_FAST,
		messages: [
			{ role: 'system', content: DocumentAnswerPrompt },
			{
				role: 'user',
				content: `
                User Query: ${query}
                Document Title: ${documentTitle}
                Document Summary: ${documentSummary}
                Table of Content: ${JSON.stringify(toc)}
                `,
			},
		],
		systemPrompt: DocumentAnswerPrompt,
		reasoningLevel: 'default',
		tools,
	});
	return response;
};

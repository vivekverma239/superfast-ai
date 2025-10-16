import { FilePart, ImagePart, LanguageModelUsage, ModelMessage, TextPart } from 'ai';
import { AI_MODEL, OPENROUTER_MODEL } from './models';
import { z } from 'zod';
import _ from 'lodash';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { generateObjectWrapper, generateTextWrapper, getAILLM } from './aisdk';
import { extractText, getDocumentProxy } from 'unpdf';
// import { parseJson } from '../utils';
// import { err, ok } from 'neverthrow';
import { withUsageTracking } from '../utils/usageAsyncContext';

export type ParsedPage = {
	pageNumber: number;
	content: string;
};

export type ParsedDocument = {
	pages: ParsedPage[];
	parsingPagesTime: number;
	modelWiseUsage: Record<string, LanguageModelUsage>;
};

export const parsePagesChunk = async (getSubPDFFn: (pages: number[]) => Promise<Buffer>, start: number, end: number) => {
	const subPdf = await getSubPDFFn(_.range(start, end + 1));
	const systemPrompt = `
    You are an expert at  extracting content from images with precise formatting preservation.
    
    You are given a sequence of pages from pdf document, your job is to parse all the content from pages in markdown format
    make sure to extract tables in markdown format, for charts and figure extract a suitable description along with 
    any relevant data in table format. You must use markdown headings and lists.

    Important:
    - MUST use markdown headings 
    - Do not output gibberish from figures or charts, just explain insights or data
    - IGNORE headers and footers which are common across pages
    - Do not miss any important information from the page

    Follow the following format for the output:
    \`\`\`json
    {
      pages: [
        {
          pageNumber: number,
          content: string
        }
        ...
      ]
    }
    \`\`\`
    

    Only output the json object, no other text or comments.
      `;
	const finalMessages = [
		{
			role: 'system',
			content: systemPrompt,
		},
	] as ModelMessage[];

	finalMessages.push({
		role: 'user',
		content: [
			{
				type: 'text',
				text: `Here are images for pages ${start} to ${end}`,
			},

			{
				type: 'file',
				data: subPdf,
				mediaType: 'application/pdf',
			} as FilePart,
		],
	});

	// Call the model
	const response = await generateObjectWrapper<{ pages: ParsedPage[] }>({
		// model: OPENROUTER_MODEL.GROK_4_FAST,
		model: AI_MODEL.GEMINI_2_0_FLASH,
		// model: AI_MODEL.GEMINI_2_5_FLASH_LITE_LATEST,

		messages: finalMessages,
		schema: z.object({
			pages: z.array(
				z.object({
					pageNumber: z.number(),
					content: z.string(),
				})
			),
		}),
		reasoningLevel: 'default',
	});

	return response;
};

export const parsePagesFromBuffer = async (pdfBuffer: Buffer, getSubPDFFn: (pages: number[]) => Promise<Buffer>) => {
	const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
	const { totalPages, text } = await extractText(pdf);

	const pages = text.map((t, pageNumber) => ({
		pageNumber: pageNumber + 1,
		text: t,
	}));
	// Convert to images and parse in chunks

	const extractedPages: ParsedPage[] = [];

	const limit = pLimit(25); // lower concurrency to reduce peak memory
	const tasks = [] as Promise<void>[];
	const progress = new cliProgress.SingleBar({
		format: 'Parsing pages {bar} {percentage}% | {value}/{total}',
	});
	const batchSize = 2; // smaller batch to limit memory
	progress.start(Math.ceil(totalPages / batchSize), 0);

	for (let i = 0; i < totalPages; i += batchSize) {
		tasks.push(
			limit(async () => {
				// Convert pages
				const start = i + 1;
				const end = Math.min(i + batchSize, totalPages);

				const response = await parsePagesChunk(getSubPDFFn, start, end);

				if (response.isErr()) {
					console.error(response.error);
					return;
				}
				extractedPages.push(...response.value.pages);
				progress.increment();
			})
		);
	}

	await Promise.all(tasks);
	const missingPages = _.range(1, totalPages + 1).filter((page) => !extractedPages.some((p) => p.pageNumber === page));
	if (missingPages.length > 0) {
		console.log('Missing pages', missingPages);
	}
	return extractedPages.sort((a, b) => a.pageNumber - b.pageNumber);
};

export const parsePages = async (pdfBuffer: Buffer, getSubPDFFn: (pages: number[]) => Promise<Buffer>) => {
	const { result, usage, modelWiseUsage } = await withUsageTracking(
		async () => {
			console.log('Parsing document using images');
			const start = performance.now();
			const pages = await parsePagesFromBuffer(pdfBuffer, getSubPDFFn);
			const end = performance.now();
			console.log(`Parsing pages time: ${end - start} milliseconds`);
			const parsingPagesTime = end - start;

			return { pages, parsingPagesTime };
		},
		{
			functionName: 'parseDocUsingText',
		}
	);

	console.log('Total Usage', usage?.totalUsage);
	console.log('Model Wise Usage', modelWiseUsage);
	return {
		pages: result.pages,
		parsingPagesTime: result.parsingPagesTime,
		modelWiseUsage: modelWiseUsage,
	} as ParsedDocument;
};

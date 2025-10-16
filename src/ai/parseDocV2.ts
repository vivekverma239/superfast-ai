import { ModelMessage, TextPart } from 'ai';
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
import { parsePDFFromImages } from './parseDoc';

export type ChunkPageSummary = {
	pageNumber: number;
	summary: string;
	keyPoints: string[];
};

export type PageText = {
	pageNumber: number;
	text: string;
};

export const DocumentMetadataSchema = z.object({
	title: z.string().describe('Short 10-20 words title for the document, must contain relevant entities name and dates'),
	shortSummary: z.string(),
	summary: z
		.string()
		.describe(
			'A general summary of the document in 100-150 words, should give an overview of the document and its main points, add relevant entities name and dates etc'
		),
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

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type Toc = {
	sections: TocSection[];
};

export type TocSection = {
	title: string;
	pageStart: number;
	pageEnd: number;
	summary: string;
	subsections: TocSubsection[];
};

export type TocSubsection = {
	title: string;
	pageStart: number;
	pageEnd: number;
	summary: string;
};

export type ParsedDocument = {
	pages: ChunkPageSummary[];
	metadata: DocumentMetadata;
	toc: Toc;
	parsingPagesTime: number;
	parsingMetadataTime: number;
	parsingTocTime: number;
};

export const parseTocFromPageSummaries = async (pageSummaries: ChunkPageSummary[]) => {
	const toc = [] as TocSection[];
	const systemPrompt = `
You are an expert document analyst specializing in table of contents extraction. Your task is to analyze page summaries and create a comprehensive, hierarchical table of contents.

## Analysis Guidelines:

1. **Content Identification**:
   - Identify main sections (chapters, major topics, primary themes)
   - Identify subsections (subtopics, detailed discussions within main sections)
   - Look for clear section headers, titles, and topic transitions
   - Pay attention to document structure indicators (numbered sections, bullet points, etc.)

2. **Page Range Assignment**:
   - Use ONLY the page numbers provided in the summaries
   - Assign accurate page ranges for each section and subsection
   - Ensure page ranges are logical and non-overlapping
   - If a section spans multiple pages, use the full range

3. **Hierarchical Structure**:
   - Create clear main sections with descriptive titles
   - Group related content into subsections under main sections
   - Maintain logical document flow and organization
   - Ensure subsections belong to the most appropriate main section

4. **Summary Creation**:
   - Write concise but informative summaries for each section/subsection
   - Capture the main themes and key topics covered
   - Include important details that help understand the section's purpose
   - Keep summaries between 1-3 sentences

5. **Quality Standards**:
   - Use clear, professional language for titles
   - Ensure titles accurately reflect the content
   - Avoid overly generic titles like "Introduction" unless clearly appropriate
   - Make titles specific enough to be useful for navigation

## Important Notes:
- Only extract content that is clearly identifiable as a distinct section
- If content doesn't fit into a clear section structure, create appropriate groupings
- Ensure all page ranges are accurate and logical
- Focus on creating a useful navigation structure for the document
  `;

	const limit = pLimit(25);
	const tasks = [] as Promise<void>[];
	const schema = z.object({
		sections: z.array(
			z.object({
				title: z.string(),
				pageStart: z.number(),
				pageEnd: z.number(),
				summary: z.string(),
				subsections: z.array(
					z.object({
						title: z.string(),
						pageStart: z.number(),
						pageEnd: z.number(),
						summary: z.string(),
					})
				),
			})
		),
	});
	for (let i = 0; i < pageSummaries.length; i += 50) {
		tasks.push(
			limit(async () => {
				let retryCount = 0;
				while (retryCount < 3) {
					try {
						const batch = pageSummaries.slice(i, i + 50);

						const messages: ModelMessage[] = [
							{
								role: 'system',
								content: systemPrompt,
							},
							{
								role: 'user',
								content: `Here are the page summaries: ${batch.map((p) => `Page ${p.pageNumber}: ${p.summary}`).join('\n')}`,
							},
						];

						const response = await generateObjectWrapper<Toc>({
							model: AI_MODEL.GEMINI_2_5_FLASH_LITE_LATEST,
							messages,
							schema: schema,
							reasoningLevel: 'default',
						});
						if (response.isErr()) {
							console.error(response.error);
							throw new Error('Failed to extract toc for batch');
						}

						toc.push(...response.value.sections);
						break;
					} catch (error: any) {
						console.error(`Failed to extract toc for batch ${i}`, error);
						retryCount++;
						if (retryCount === 3) {
							throw error;
						}
					}
				}
			})
		);
	}
	await Promise.all(tasks);

	const sortedToc = toc.sort((a, b) => a.pageStart - b.pageStart);

	return sortedToc;
};

export const parsePageSummaries = async (pages: PageText[], start: number, end: number) => {
	const currentPages = pages.slice(start - 1, end);
	const previousPages = [] as PageText[];
	if (start - 10 > 0) {
		const pageTexts = pages.slice(start - 10, start - 1);
		previousPages.push(...pageTexts);
	}

	// const currentPages = await getPagesData(fileId, env, start, end);
	// const previousPages = [] as ArrayBuffer[];
	// if (start - 10 > 0) {
	// 	const images = await getPagesData(fileId, env, start - 10, start - 1);
	// 	previousPages.push(...images);
	// }
	const systemPrompt = `
    You are an expert at parsing the text content and summarizing information within documents.
    
    Your task is to analyze a sequence of page text and extract comprehensive summaries for each page. Follow these guidelines:
    
    ## Summary Requirements:
    1. **Comprehensive Coverage**: Extract ALL meaningful content from each page, including:
       - Headers, titles, and section headings
       - Key data points, numbers, and statistics
       - Important names, dates, and locations
       - Bullet points and lists
    
    2. **Contextual Understanding**: Use previous pages as context to:
       - Understand document structure and flow
       - Maintain consistency in terminology
       - Connect related information across pages
       - Identify recurring themes or patterns
    
    3. **Summary Quality**:
       - Write clear, concise summaries (2-4 sentences)
       - Preserve important details and specific information
       - Use professional, objective language
       - Maintain the original meaning and intent
    
    4. **Key Points Extraction**:
       - Identify 3-7 most important points per page
       - Include specific data, names, or facts when relevant
       - Prioritize actionable or significant information
       - Ensure each key point is distinct and valuable
    
    ## Important Notes:
    - Process EVERY page, even if it appears empty or contains only images
    - Use the page numbers provided in the prompt, not those visible in images
    - Do NOT extract data from previous pages - only use them for context
    - If a page is blank or contains only decorative elements, note this in the summary
    - For pages with complex layouts, ensure you capture all sections and elements
    - Maintain accuracy and completeness - it's better to include too much than miss important details

    Follow the following format for the output:
    \`\`\`json
    {
      pages: [
        {
          pageNumber: number,
          summary: string,
          keyPoints: string[],
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
			...(currentPages ?? [])
				.map((page, index) => [
					{
						type: 'text',
						text: `Page number: ${start + index}`,
					} as TextPart,
					{
						type: 'text',
						text: `<page num="${start + index}">${page.text}</page>`,
					} as TextPart,
				])
				.flat(),
			...(previousPages ?? [])
				.map((page, index) => [
					{
						type: 'text',
						text: `Page number: ${start - 10 + index}`,
					} as TextPart,
					{
						type: 'text',
						text: `<page num="${start - 10 + index}">${page.text}</page>`,
					} as TextPart,
				])
				.flat(),
		],
	});

	// Call the model
	const response = await generateObjectWrapper<{ pages: ChunkPageSummary[] }>({
		// model: OPENROUTER_MODEL.GROK_4_FAST,
		model: AI_MODEL.GEMINI_2_5_FLASH_LITE_LATEST,
		messages: finalMessages,
		schema: z.object({
			pages: z.array(
				z.object({
					pageNumber: z.number(),
					summary: z.string(),
					keyPoints: z.array(z.string()),
				})
			),
		}),
		reasoningLevel: 'default',
	});

	// if (response.isErr()) {
	// 	console.error(response.error);
	// 	return err(response.error);
	// }

	// // Parse the response
	// const responseJson = parseJson(response.value.text) as { pages: ChunkPageSummary[] };
	// if (responseJson === null) {
	// 	console.log(response.value.text);
	// 	console.error('Failed to parse page summaries');
	// 	return err(new Error('Failed to parse page summaries'));
	// }
	// return ok(responseJson);
	return response;
};

export const parsePDFFromText = async (pdfBuffer: Buffer) => {
	const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
	const { totalPages, text } = await extractText(pdf);

	const pages = text.map((t, pageNumber) => ({
		pageNumber: pageNumber + 1,
		text: t,
	}));
	// Convert to images and parse in chunks

	const extractedPages: ChunkPageSummary[] = [];

	const limit = pLimit(25); // lower concurrency to reduce peak memory
	const tasks = [] as Promise<void>[];
	const progress = new cliProgress.SingleBar({
		format: 'Parsing pages {bar} {percentage}% | {value}/{total}',
	});
	const batchSize = 10; // smaller batch to limit memory
	progress.start(Math.ceil(totalPages / batchSize), 0);

	for (let i = 0; i < totalPages; i += batchSize) {
		tasks.push(
			limit(async () => {
				// Convert pages
				const start = i + 1;
				const end = Math.min(i + batchSize, totalPages);

				const response = await parsePageSummaries(pages, start, end);

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

export const parseMetadataFromPages = async (pages: ChunkPageSummary[]) => {
	const systemPrompt = `
  You are an expert at extracting metadata from pages from a pdf document.

  Your task is to analyze the pages and extract the metadata.

  Follow these guidelines:

  - Extract the title of the document, must contain relevant entities name and dates
  - Extract the author of the document
  - Extract the publisher of the document
  - Extract the published date of the document
  - Extract the language of the document
  - Extract the keywords of the document
  - Extract the categories of the document
  `;

	const response = await generateObjectWrapper<DocumentMetadata>({
		model: AI_MODEL.GEMINI_2_5_FLASH_LITE_LATEST,
		messages: [
			{ role: 'system', content: systemPrompt },
			{
				role: 'user',
				content: pages.map((p) => `Page ${p.pageNumber}: ${p.summary}`).join('\n'),
			},
		],
		schema: DocumentMetadataSchema,
		reasoningLevel: 'default',
	});

	if (response.isErr()) {
		console.error(response.error);
		throw new Error('Failed to extract metadata from pages');
	}

	return response.value;
};

export const parseDocUsingText = async (pdfBuffer: Buffer): Promise<ParsedDocument> => {
	const { result, usage, modelWiseUsage } = await withUsageTracking(
		async () => {
			console.log('Parsing document using images');
			const start = performance.now();
			const pages = await parsePDFFromText(pdfBuffer);
			const end = performance.now();
			console.log(`Parsing pages time: ${end - start} milliseconds`);
			const parsingPagesTime = end - start;

			console.log('Parsing metadata from pages');
			const metadata = await parseMetadataFromPages(pages);
			const end2 = performance.now();
			console.log(`Parsing metadata time: ${end2 - end} milliseconds`);
			const parsingMetadataTime = end2 - end;
			console.log('Parsing toc from pages');
			const toc = await parseTocFromPageSummaries(pages);
			const end3 = performance.now();
			console.log(`Parsing toc time: ${end3 - end2} milliseconds`);
			const parsingTocTime = end3 - end2;
			console.log('Parseing complete');
			return { pages, metadata, toc: { sections: toc }, parsingPagesTime, parsingMetadataTime, parsingTocTime };
		},
		{
			functionName: 'parseDocUsingText',
		}
	);

	console.log('Total Usage', usage?.totalUsage);
	console.log('Model Wise Usage', modelWiseUsage);
	return result;
};

import { ImagePart, ModelMessage, TextPart } from 'ai';
import { AI_MODEL, OPENROUTER_MODEL } from './models';
import { z } from 'zod';
import _ from 'lodash';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { generateObjectWrapper, getAILLM } from './aisdk';
import { extractText, getDocumentProxy } from 'unpdf';
import { tasks, runs } from '@trigger.dev/sdk';
import { getS3 } from '../s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withUsageTracking } from '../utils/usageAsyncContext';

export const convertAndUploadImages = async (downloadUrl: string, fileId: string, env: Env, numPages: number) => {
	// Try to see if already parsed
	const metadata = await env.BUCKET.get(`documents/${fileId}/pdf2images.json`);
	if (metadata) {
	} else {
		console.log('Converting PDF to images..');
		const result = await tasks.trigger('pdf-to-image', {
			downloadUrl,
			fileId,
		});
		console.log(result);

		// Wait for the task to complete
		const resultId = result.id;
		let totalAttempts = 0;
		while (true) {
			const result = await runs.retrieve(resultId);
			if (result.isCompleted) {
				break;
			}
			totalAttempts++;
			if (totalAttempts > 30) {
				throw new Error('Failed to convert PDF to images');
			}
			console.log('Waiting for PDF to image task to complete...');
			await new Promise((resolve) => setTimeout(resolve, 10000));
		}
		console.log('PDF to image task completed');
	}

	console.log('Images uploaded');

	// Get the images from R2
	const S3 = getS3(env);
	const imageUrls = await Promise.all(
		Array.from({ length: numPages }, (_, i) =>
			getSignedUrl(
				S3,
				new GetObjectCommand({
					Bucket: env.BUCKET_NAME,
					Key: `documents/${fileId}/images/page-${i + 1}.png`,
				}),
				{
					expiresIn: 60 * 60, // 1 day
				}
			)
		)
	);
	// Upload metadata to make sure the images are uploaded
	await env.BUCKET.put(
		`documents/${fileId}/pdf2images.json`,
		JSON.stringify({
			fileId,
			numPages,
		})
	);

	console.log('Images fetched');

	return imageUrls;
};

export type ChunkPageSummary = {
	pageNumber: number;
	summary: string;
	keyPoints: string[];
};

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

export const parseTocFroPageSummaries = async (pageSummaries: ChunkPageSummary[]) => {
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

	const limit = pLimit(10);
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
							model: OPENROUTER_MODEL.GROK_4_FAST,
							messages,
							schema: schema,
							reasoningLevel: 'none',
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

	//   // Combine the toc sections
	//   const systemPromptCombine = `
	// You are an expert document analyst specializing in table of contents consolidation. Your task is to merge multiple table of contents fragments into a single, coherent, and comprehensive table of contents.

	// ## Consolidation Guidelines:

	// 1. **Duplicate Detection & Merging**:
	//    - Identify sections with similar or identical titles
	//    - Merge overlapping page ranges into single sections
	//    - Combine summaries from duplicate sections into comprehensive descriptions
	//    - Resolve conflicts by choosing the most accurate page ranges

	// 2. **Hierarchical Organization**:
	//    - Ensure proper main section and subsection relationships
	//    - Group related subsections under appropriate main sections
	//    - Maintain logical document flow and structure
	//    - Create clear, non-overlapping section boundaries

	// 3. **Page Range Optimization**:
	//    - Merge overlapping page ranges intelligently
	//    - Ensure all page ranges are continuous and logical
	//    - Fill gaps where content exists but wasn't captured in individual fragments
	//    - Validate that page ranges don't have conflicts

	// 4. **Content Quality**:
	//    - Combine and refine section summaries for clarity and completeness
	//    - Ensure titles are descriptive and non-redundant
	//    - Maintain consistent naming conventions
	//    - Remove duplicate or redundant entries

	// 5. **Structure Validation**:
	//    - Ensure the final TOC follows a logical document structure
	//    - Verify that all sections have appropriate subsections
	//    - Check that page ranges are in ascending order
	//    - Ensure no content gaps or overlaps exist

	// ## Important Notes:
	// - Prioritize accuracy and completeness over brevity
	// - When merging sections, combine the best elements from each fragment
	// - Ensure the final TOC provides a clear navigation structure
	// - Maintain the original document's logical flow and organization
	//   `;

	//   const messagesCombine: ModelMessage[] = [
	//     {
	//       role: "system",
	//       content: systemPromptCombine,
	//     },
	//     {
	//       role: "user",
	//       content: `Here is the table of contents: ${sortedToc.map((t) => `Sections ${JSON.stringify(t)}`).join("\n")}`,
	//     },
	//   ];

	//   const responseCombine = await generateObjectWrapper<Toc>({
	//     model: OPENROUTER_MODEL.GROK_4_FAST,
	//     messages: messagesCombine,
	//     schema: schema,
	//     reasoningLevel: "none",
	//   });

	//   if (responseCombine.isErr()) {
	//     console.error(responseCombine.error);
	//     throw new Error("Failed to combine toc");
	//   }

	//   return responseCombine.value.sections;
	return sortedToc;
};

const getPagesData = async (fileId: string, env: Env, start: number, end: number) => {
	const items = await Promise.all(
		_.range(start, end + 1).map(async (page) => {
			const pageData = await env.BUCKET.get(`images/${fileId}/page-${page}.png`);
			const pageDataBuffer = pageData ? await pageData.arrayBuffer() : null;
			return {
				pageNumber: page,
				page: pageDataBuffer,
			};
		})
	);
	const pages = [] as ArrayBuffer[];
	for (const item of items) {
		if (item.page) {
			pages.push(item.page);
		} else {
			console.error(`Page ${item.pageNumber} not found`);
		}
	}
	return pages;
};

export const parseBatchImages = async (fileId: string, pageUrls: string[], env: Env, start: number, end: number) => {
	const currentPages = _.range(start, end + 1).map((page) => pageUrls[page - 1]);
	const previousPages = [] as string[];
	if (start - 10 > 0) {
		const images = await Promise.all(_.range(start - 10, start).map((page) => pageUrls[page - 1]));
		previousPages.push(...images);
	}

	// const currentPages = await getPagesData(fileId, env, start, end);
	// const previousPages = [] as ArrayBuffer[];
	// if (start - 10 > 0) {
	// 	const images = await getPagesData(fileId, env, start - 10, start - 1);
	// 	previousPages.push(...images);
	// }
	const systemPrompt = `
    You are an expert at OCRing images and parsing the content and summarizing information within documents.
    
    Your task is to analyze a sequence of page images and extract comprehensive summaries for each page. Follow these guidelines:
    
    ## Summary Requirements:
    1. **Comprehensive Coverage**: Extract ALL meaningful content from each page, including:
       - Headers, titles, and section headings
       - Key data points, numbers, and statistics
       - Important names, dates, and locations
       - Tables, charts, and their key insights
       - Bullet points and lists
       - Any footnotes or annotations
    
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
						type: 'image',
						image: page,
						mediaType: 'image/png',
					} as ImagePart,
				])
				.flat(),
			...(previousPages ?? [])
				.map((page, index) => [
					{
						type: 'text',
						text: `Page number: ${start - 10 + index}`,
					} as TextPart,
					{
						type: 'image',
						image: page,
						mediaType: 'image/png',
					} as ImagePart,
				])
				.flat(),
		],
	});

	// Call the model
	const response = await generateObjectWrapper<{
		pages: ChunkPageSummary[];
	}>({
		// model: OPENROUTER_MODEL.GROK_4_FAST,
		model: AI_MODEL.XAI_GROK_4_REASONING,
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
		reasoningLevel: 'none',
	});

	return response;
};

export const parsePDFFromImages = async (fileId: string, numPages: number, downloadUrl: string, env: Env) => {
	// Convert to images and parse in chunks

	const extractedPages: ChunkPageSummary[] = [];

	const limit = pLimit(10); // lower concurrency to reduce peak memory
	const tasks = [] as Promise<void>[];
	const progress = new cliProgress.SingleBar({
		format: 'Parsing pages {bar} {percentage}% | {value}/{total}',
	});
	const batchSize = 10; // smaller batch to limit memory
	progress.start(Math.ceil(numPages / batchSize), 0);

	const pageUrls = await convertAndUploadImages(downloadUrl, fileId, env, numPages);
	for (let i = 0; i < numPages; i += batchSize) {
		tasks.push(
			limit(async () => {
				// Convert pages
				const start = i + 1;
				const end = Math.min(i + batchSize, numPages);
				const response = await parseBatchImages(fileId, pageUrls, env, start, end);
				if (response.isErr()) {
					console.error(response.error);
					throw new Error('Failed to parse batch images');
				}
				extractedPages.push(...response.value.pages);
				progress.increment();
			})
		);
	}

	await Promise.all(tasks);
	const missingPages = _.range(1, numPages + 1).filter((page) => !extractedPages.some((p) => p.pageNumber === page));
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

  - Extract the title of the document
  - Extract the author of the document
  - Extract the publisher of the document
  - Extract the published date of the document
  - Extract the language of the document
  - Extract the keywords of the document
  - Extract the categories of the document
  `;

	const llm = getAILLM(OPENROUTER_MODEL.GROK_4_FAST);

	const response = await generateObjectWrapper<DocumentMetadata>({
		model: OPENROUTER_MODEL.GROK_4_FAST,
		messages: [
			{ role: 'system', content: systemPrompt },
			{
				role: 'user',
				content: pages.map((p) => `Page ${p.pageNumber}: ${p.summary}`).join('\n'),
			},
		],
		schema: DocumentMetadataSchema,
		reasoningLevel: 'none',
	});

	if (response.isErr()) {
		console.error(response.error);
		throw new Error('Failed to extract metadata from pages');
	}

	return response.value;
};

export const parseDocUsingImages = async (fileId: string, numPages: number, downloadUrl: string, env: Env): Promise<ParsedDocument> => {
	const { result, usage, modelWiseUsage } = await withUsageTracking(
		async () => {
			console.log('Parsing document using images');
			const start = performance.now();
			const pages = await parsePDFFromImages(fileId, numPages, downloadUrl, env);
			const end = performance.now();
			console.log(`Parsing pages time: ${end - start} milliseconds`);
			const parsingPagesTime = end - start;

			console.log('Parsing metadata from pages');
			const metadata = await parseMetadataFromPages(pages);
			const end2 = performance.now();
			console.log(`Parsing metadata time: ${end2 - end} milliseconds`);
			const parsingMetadataTime = end2 - end;
			console.log('Parsing toc from pages');
			const toc = await parseTocFroPageSummaries(pages);
			const end3 = performance.now();
			console.log(`Parsing toc time: ${end3 - end2} milliseconds`);
			const parsingTocTime = end3 - end2;
			console.log('Parseing complete');
			return { pages, metadata, toc: { sections: toc }, parsingPagesTime, parsingMetadataTime, parsingTocTime };
		},
		{
			functionName: 'parseDocUsingImages',
		}
	);

	console.log('Total Usage', usage?.totalUsage);
	console.log('Model Wise Usage', modelWiseUsage);
	return result;
};

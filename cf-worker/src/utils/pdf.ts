import { extractText, getDocumentProxy } from "unpdf";
import { PDFDocument } from "pdf-lib";

export const extractPageContent = async (
  pdfBuffer: Uint8Array
): Promise<{ pageNumber: number; content: string }[]> => {
  const pdf = await getDocumentProxy(pdfBuffer);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts: string[] = Array.isArray(text)
    ? text
    : [text as unknown as string];
  const rawPages: Array<{ pageNumber: number; content: string }> =
    pageTexts.map((t, idx) => ({ pageNumber: idx + 1, content: t ?? "" }));
  return rawPages;
};

export const getPdfHash = async (pdfBuffer: Uint8Array): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", pdfBuffer);
  return Buffer.from(hash).toString("hex");
};

export async function createSubPdf(pdfBytes: Buffer, pageNumbers: number[]) {
  const sourcePdf = await PDFDocument.load(pdfBytes);
  const totalPages = sourcePdf.getPageCount();

  // Normalize, dedupe, validate, and sort pages (assume 1-based input)
  const normalizedIndices: Array<number> = (
    Array.isArray(pageNumbers) ? Array.from(new Set(pageNumbers)) : []
  )
    .filter((p) => Number.isInteger(p) && p > 0 && p <= totalPages)
    .map((p) => p - 1)
    .sort((a, b) => a - b);

  const indicesToCopy: Array<number> =
    normalizedIndices.length > 0
      ? normalizedIndices
      : Array.from({ length: totalPages }, (_, i) => i);

  const targetPdf = await PDFDocument.create();
  const copiedPages = await targetPdf.copyPages(sourcePdf, indicesToCopy);
  for (const page of copiedPages) {
    targetPdf.addPage(page);
  }

  const saved = await targetPdf.save();
  // Return a clean ArrayBuffer view of the PDF bytes
  const arrayBuffer = saved.buffer.slice(
    saved.byteOffset,
    saved.byteOffset + saved.byteLength
  );
  // Convert to base64
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return base64;
}

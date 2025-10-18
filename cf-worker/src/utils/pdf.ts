import { extractText, getDocumentProxy } from "unpdf";

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

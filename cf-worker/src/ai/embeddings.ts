import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { Bindings } from "../types";

export const getEmbeddings = async (texts: string[]) => {
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  // Make sure to do in batches of 100
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const embedding = await embedMany({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      values: batch.map((text) => text.trim() || "No text"),
      providerOptions: {
        google: {
          outputDimensionality: 1024,
        },
      },
      maxRetries: 10,
    });
    embeddings.push(...embedding.embeddings);
  }
  return embeddings;
};

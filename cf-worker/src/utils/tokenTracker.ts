import { AsyncLocalStorage } from "node:async_hooks";
import { LanguageModelUsage } from "ai";

const tokenTracker = new AsyncLocalStorage<{
  modelUsage: Record<string, LanguageModelUsage>;
}>();

export const getTokenTracker = () => {
  return tokenTracker.getStore() ?? { modelUsage: {} };
};

export const runWithTokenTracker = async <T, TArgs extends readonly unknown[]>(
  fn: (...args: TArgs) => Promise<T>,
  ...args: TArgs
): Promise<T> => {
  return tokenTracker.run({ modelUsage: {} }, fn, ...args);
};

export const addModelUsage = (model: string, usage: LanguageModelUsage) => {
  const tokenTracker = getTokenTracker();

  let currentUsage: LanguageModelUsage = tokenTracker.modelUsage[model];
  if (!currentUsage) {
    currentUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    } as LanguageModelUsage;
  }

  for (const key in currentUsage) {
    currentUsage[key as keyof LanguageModelUsage] =
      (usage[key as keyof LanguageModelUsage] ?? 0) +
      (currentUsage[key as keyof LanguageModelUsage] ?? 0);
  }

  tokenTracker.modelUsage[model] = currentUsage;
  console.log(tokenTracker.modelUsage);
};

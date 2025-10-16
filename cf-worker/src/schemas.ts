import { z } from "zod";

// Folder schemas
export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(255),
});

// File schemas
export const createFileSchema = z.object({
  title: z.string().min(1).max(255),
  folderId: z.string().length(21),
  fileType: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
});

// Chat schemas
export const createChatSchema = z.object({
  title: z.string().max(255).optional(),
  folderId: z.string().length(21).optional().nullable(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
});

// Infer types from schemas
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
export type CreateChatInput = z.infer<typeof createChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

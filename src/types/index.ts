// Central type definitions for the application

export type Folder = {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  fileCount?: number;
};

export type File = {
  id: string;
  title: string;
  folderId: string;
  s3Key: string;
  fileType: string | null;
  fileSize: number | null;
  metadata: {
    summary?: string;
    tags?: string[];
    pageCount?: number;
  } | null;
  userId: string;
  createdAt: number;
  downloadUrl?: string;
};

export type Chat = {
  id: string;
  title: string | null;
  folderId: string | null;
  userId: string;
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  metadata: {
    sources?: {
      fileId: string;
      fileName: string;
      excerpt: string;
    }[];
  } | null;
  createdAt: number;
};

export type ChatWithMessages = Chat & {
  messages: Message[];
};

export type FileUploadResponse = {
  file: File;
  uploadUrl: string;
};

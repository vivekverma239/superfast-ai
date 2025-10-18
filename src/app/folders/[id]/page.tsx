"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FilesPanel } from "@/components/files-panel";
import ChatInterface from "@/components/chat-interface";
import { FileUploadDialog } from "@/components/file-upload-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workerRequest } from "@/lib/worker";
import Link from "next/link";

type Folder = {
  id: string;
  name: string;
  createdAt: number;
  fileCount: number;
};

export default function FolderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const folderId = params.id as string;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [activeTab, setActiveTab] = useState<"files" | "chats">("files");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [refreshFilesKey, setRefreshFilesKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (folderId) {
      loadFolder();
    }
  }, [folderId]);

  const loadFolder = async () => {
    setLoading(true);
    try {
      const folderData = await workerRequest<Folder>(
        `/api/folders/${folderId}`
      );
      setFolder(folderData);
    } catch (error) {
      console.error("Error loading folder:", error);
      // Redirect to folders page if folder not found
      router.push("/folders");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    setIsUploadDialogOpen(true);
  };

  const handleUploadComplete = () => {
    // Trigger refresh of files panel
    setRefreshFilesKey((prev) => prev + 1);
    // Refresh folder data to update file count
    loadFolder();
  };

  const handleBackToFolders = () => {
    router.push("/folders");
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading folder...</p>
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Folder not found</h2>
          <p className="text-muted-foreground mb-4">
            The folder you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have access to it.
          </p>
          <button
            onClick={handleBackToFolders}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Folders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Folder Header */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/folders">
              <button
                onClick={handleBackToFolders}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
            </Link>
            <h1 className="text-lg font-semibold">{folder.name}</h1>
            <span className="text-sm text-muted-foreground">
              {folder.fileCount} {folder.fileCount === 1 ? "file" : "files"}
            </span>
          </div>
          {/* <button
            onClick={handleUploadClick}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Upload File
          </button> */}
          <div>
            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(value: string) =>
                setActiveTab(value as "files" | "chats")
              }
              className="flex-1 flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="files" className="text-sm">
                  Files
                </TabsTrigger>
                <TabsTrigger value="chats" className="text-sm">
                  Chats
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {activeTab === "files" && (
        <FilesPanel
          key={refreshFilesKey}
          selectedFolderId={folderId}
          onUploadClick={handleUploadClick}
        />
      )}
      {activeTab === "chats" && <ChatInterface />}

      {/* Upload Dialog */}
      {isUploadDialogOpen && (
        <FileUploadDialog
          isOpen={isUploadDialogOpen}
          onClose={() => setIsUploadDialogOpen(false)}
          folderId={folderId}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}

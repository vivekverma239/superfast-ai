"use client";

import { useState } from "react";
import { FolderSidebar } from "@/components/folder-sidebar";
// import { ChatInterface } from "@/components/chat-interface";
import { FilesPanel } from "@/components/files-panel";
import { FileUploadDialog } from "@/components/file-upload-dialog";

export default function Home() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [refreshFilesKey, setRefreshFilesKey] = useState(0);

  const handleUploadClick = (folderId?: string) => {
    if (folderId) {
      setUploadFolderId(folderId);
    } else if (selectedFolderId) {
      setUploadFolderId(selectedFolderId);
    } else {
      alert("Please select a folder first");
      return;
    }
    setIsUploadDialogOpen(true);
  };

  const handleUploadComplete = () => {
    // Trigger refresh of files panel
    setRefreshFilesKey((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen bg-background">
      <FolderSidebar
        selectedFolderId={selectedFolderId}
        onFolderSelect={setSelectedFolderId}
        onUploadClick={handleUploadClick}
      />
      {/* <ChatInterface
        selectedFolderId={selectedFolderId}
        onUploadClick={() => handleUploadClick()}
      /> */}
      <FilesPanel
        key={refreshFilesKey}
        selectedFolderId={selectedFolderId}
        onUploadClick={() => handleUploadClick()}
      />

      {uploadFolderId && (
        <FileUploadDialog
          isOpen={isUploadDialogOpen}
          onClose={() => setIsUploadDialogOpen(false)}
          folderId={uploadFolderId}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}

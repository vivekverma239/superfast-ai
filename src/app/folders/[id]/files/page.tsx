"use client";

import { useState } from "react";
import { FilesPanel } from "@/components/files-panel";
import { FileUploadDialog } from "@/components/file-upload-dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface FilesPageProps {
  params: Promise<{ id: string }>;
}

export default function FilesPage({ params }: FilesPageProps) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [refreshFilesKey, setRefreshFilesKey] = useState(0);

  // Resolve params
  params.then(({ id }) => setFolderId(id));

  const handleUploadClick = () => {
    setIsUploadDialogOpen(true);
  };

  const handleUploadComplete = () => {
    // Trigger refresh of files panel
    setRefreshFilesKey((prev) => prev + 1);
  };

  if (!folderId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* <div className="px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h2 className="text-lg font-semibold transition-all">Files</h2>

          <div className="flex-1" />

          <Button onClick={handleUploadClick} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div> */}

      <FilesPanel
        key={refreshFilesKey}
        selectedFolderId={folderId}
        onUploadClick={handleUploadClick}
      />

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

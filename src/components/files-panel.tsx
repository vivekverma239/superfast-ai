"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { FileText, Download, Trash2, Upload, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { workerRequest } from "@/lib/worker";

type FileType = {
  id: string;
  title: string;
  folderId: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: number;
};

type FilesPanelProps = {
  selectedFolderId: string | null;
  onUploadClick: () => void;
};

export function FilesPanel({
  selectedFolderId,
  onUploadClick,
}: FilesPanelProps) {
  const [files, setFiles] = useState<FileType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedFolderId) {
      loadFiles();
    } else {
      setFiles([]);
    }
  }, [selectedFolderId]);

  const loadFiles = async () => {
    if (!selectedFolderId) return;

    setLoading(true);
    try {
      const data = await workerRequest<FileType[]>(
        `/api/files?folderId=${selectedFolderId}`
      );
      setFiles(data);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await workerRequest(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      setFiles(files.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!selectedFolderId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Folder Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a folder from the sidebar to view its files
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 border-l flex flex-col h-screen bg-muted/10">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Files</h2>
          <Button onClick={onUploadClick} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {files.length} {files.length === 1 ? "file" : "files"}
        </p>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No files in this folder yet
            </p>
            <Button onClick={onUploadClick} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {files.map((file) => (
              <Card
                key={file.id}
                className="p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate mb-1">
                      {file.title}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {file.fileType?.split("/")[1]?.toUpperCase() || "FILE"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => deleteFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

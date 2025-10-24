"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  FileText,
  Trash2,
  Upload,
  FolderOpen,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  Download,
  RotateCcw,
  Search,
  X,
  Eye,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workerRequest } from "@/lib/worker";
import { PDFViewer } from "@/components/pdf-viewer";
import { motion } from "framer-motion";
import ChatInterface from "@/components/chat-interface";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "./ui/sidebar";

type FileType = {
  id: string;
  title: string;
  folderId: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: number;
  status: "pending" | "indexed" | "error";
};

type SearchResult = {
  id: string;
  title: string;
  folderId: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: number;
  status: "pending" | "indexed" | "error";
  score: number;
  excerpt?: string;
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(
    new Set()
  );
  const [pdfViewerFile, setPdfViewerFile] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [isPdfChatOpen, setIsPdfChatOpen] = useState(false);
  const [selectedFileForChat, setSelectedFileForChat] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  const loadFiles = useCallback(async () => {
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
  }, [selectedFolderId]);

  useEffect(() => {
    if (selectedFolderId) {
      loadFiles();
    } else {
      setFiles([]);
    }
  }, [selectedFolderId, loadFiles]);

  const deleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      await workerRequest(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      setFiles(files.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const processFile = async (fileId: string) => {
    setProcessingFiles((prev) => new Set(prev).add(fileId));

    try {
      await workerRequest(`/api/files/${fileId}/index`, {
        method: "POST",
      });

      // Reload files to get updated status
      await loadFiles();
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Failed to process file. Please try again.");
    } finally {
      setProcessingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const downloadFile = async (fileId: string) => {
    try {
      const fileData = await workerRequest<{ downloadUrl: string }>(
        `/api/files/${fileId}`
      );

      // Create a temporary link to download the file
      const link = document.createElement("a");
      link.href = fileData.downloadUrl;
      link.target = "_blank";
      link.download = files.find((f) => f.id === fileId)?.title || "file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const reprocessFile = async (fileId: string) => {
    if (!confirm("This will reprocess the file. Continue?")) return;
    await processFile(fileId);
  };

  const openPDFViewer = (fileId: string, fileName: string) => {
    setPdfViewerFile({ id: fileId, fileName });
  };

  const closePDFViewer = () => {
    setPdfViewerFile(null);
  };

  const openPdfChat = (fileId: string, fileName: string) => {
    setSelectedFileForChat({ id: fileId, fileName });
    setIsPdfChatOpen(true);
  };

  const closePdfChat = () => {
    setIsPdfChatOpen(false);
    setSelectedFileForChat(null);
  };

  const searchFiles = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearchMode(false);
      return;
    }

    setSearching(true);
    try {
      const results = await workerRequest<SearchResult[]>(
        `/api/files/search?query=${encodeURIComponent(query)}`
      );
      setSearchResults(results);
      setIsSearchMode(true);
    } catch (error) {
      console.error("Error searching files:", error);
      alert("Failed to search files. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchMode(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchFiles(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const getStatusIcon = (status: string, isProcessing: boolean) => {
    if (isProcessing) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }

    switch (status) {
      case "indexed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "pending":
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "indexed":
        return "Processed";
      case "error":
        return "Failed";
      case "pending":
      default:
        return "Pending";
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !isSearchMode) return text;

    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
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

  const isPDF = (fileType: string | null) => {
    return fileType === "application/pdf";
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

  const displayFiles = isSearchMode ? searchResults : files;
  const fileCount = isSearchMode ? searchResults.length : files.length;

  return (
    <div className="flex-1 flex flex-col bg-muted/10">
      <div className="px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h2 className="text-lg font-semibold transition-all">
            {isSearchMode ? "Search Results" : "Files"}
          </h2>
          <span className="text-sm text-muted-foreground">
            {isSearchMode
              ? searching
                ? "Searching..."
                : `${fileCount} ${fileCount === 1 ? "result" : "results"}`
              : `${fileCount} ${fileCount === 1 ? "file" : "files"}`}
          </span>
          <div className="flex-1" />

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-10 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button onClick={onUploadClick} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading files...
          </div>
        ) : displayFiles.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              {isSearchMode
                ? `No results found for "${searchQuery}"`
                : "No files in this folder yet"}
            </p>
            {!isSearchMode && (
              <Button onClick={onUploadClick} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayFiles.map((file) => {
                const isProcessing = processingFiles.has(file.id);
                // const canProcess =
                //   file.status === "pending" || file.status === "error";
                const canProcess = true;
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: displayFiles.indexOf(file) * 0.05,
                    }}
                    whileHover={{
                      scale: isPDF(file.fileType) ? 1.02 : 1,
                      y: isPDF(file.fileType) ? -2 : 0,
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`p-3 hover:shadow-md transition-all group h-32 flex flex-col relative ${
                        isPDF(file.fileType)
                          ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20"
                          : ""
                      }`}
                      onClick={() => {
                        if (isPDF(file.fileType)) {
                          openPDFViewer(file.id, file.title);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2 flex-1">
                        <FileText
                          className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                            isPDF(file.fileType)
                              ? "text-red-500"
                              : "text-blue-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0 flex flex-col">
                          <p className="font-medium text-sm break-words mb-2 line-clamp-2">
                            {highlightText(file.title, searchQuery)}
                          </p>
                          {isSearchMode &&
                            "excerpt" in file &&
                            (file as SearchResult).excerpt && (
                              <p className="text-xs text-muted-foreground mb-2 italic line-clamp-2">
                                {highlightText(
                                  (file as SearchResult).excerpt!,
                                  searchQuery
                                )}
                              </p>
                            )}
                          <div className="flex items-center gap-1.5 mb-2">
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0.5"
                            >
                              {file.fileType?.split("/")[1]?.toUpperCase() ||
                                "FILE"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.fileSize)}
                            </span>
                            {isSearchMode && "score" in file && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0.5"
                              >
                                {Math.round((file as SearchResult).score * 100)}
                                %
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1.5">
                              {getStatusIcon(file.status, isProcessing)}
                              <span className="text-xs text-muted-foreground">
                                {getStatusText(file.status)}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(file.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={isProcessing}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isPDF(file.fileType) && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPDFViewer(file.id, file.title);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                            )}
                            {isPDF(file.fileType) &&
                              file.status === "indexed" && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPdfChat(file.id, file.title);
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Answer from PDF
                                </DropdownMenuItem>
                              )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(file.id);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            {canProcess && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  processFile(file.id);
                                }}
                                disabled={isProcessing}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Process
                              </DropdownMenuItem>
                            )}
                            {file.status === "indexed" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reprocessFile(file.id);
                                }}
                                disabled={isProcessing}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reprocess
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFile(file.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* PDF Viewer */}
      {pdfViewerFile && (
        <PDFViewer
          fileId={pdfViewerFile.id}
          fileName={pdfViewerFile.fileName}
          isOpen={!!pdfViewerFile}
          onClose={closePDFViewer}
        />
      )}

      {/* PDF Chat Dialog */}
      <Dialog open={isPdfChatOpen} onOpenChange={setIsPdfChatOpen}>
        <DialogContent className="sm:max-w-5xl  h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Answer from PDF: {selectedFileForChat?.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {selectedFileForChat && (
              <ChatInterface fileChat={true} fileId={selectedFileForChat.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

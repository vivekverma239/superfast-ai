"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Folder,
  Plus,
  Trash2,
  Upload,
  FileText,
  MessageSquare,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workerRequest } from "@/lib/worker";

type FolderType = {
  id: string;
  name: string;
  fileCount?: number;
  createdAt: number;
};

type FolderSidebarProps = {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onUploadClick: (folderId: string) => void;
};

export function FolderSidebar({
  selectedFolderId,
  onFolderSelect,
  onUploadClick,
}: FolderSidebarProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const data = await workerRequest<FolderType[]>("/api/folders");
      setFolders(data);
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const newFolder = await workerRequest<FolderType>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name: newFolderName }),
      });
      setFolders([newFolder, ...folders]);
      setNewFolderName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (
      !confirm("Are you sure you want to delete this folder and all its files?")
    ) {
      return;
    }

    try {
      await workerRequest(`/api/folders/${folderId}`, { method: "DELETE" });
      setFolders(folders.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) {
        onFolderSelect(null);
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  return (
    <div className="w-80 border-r flex flex-col h-screen bg-muted/30">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Document Library</h2>

        <Button
          variant="outline"
          className="w-full mb-3"
          onClick={() => onFolderSelect(null)}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          All Documents
        </Button>

        {isCreating ? (
          <div className="flex gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
              autoFocus
            />
            <Button onClick={createFolder} size="sm">
              Add
            </Button>
            <Button
              onClick={() => {
                setIsCreating(false);
                setNewFolderName("");
              }}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading...
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No folders yet. Create one to get started.
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className={`group flex items-center justify-between p-3 rounded-lg mb-1 cursor-pointer hover:bg-accent transition-colors ${
                  selectedFolderId === folder.id ? "bg-accent" : ""
                }`}
                onClick={() => onFolderSelect(folder.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{folder.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {folder.fileCount || 0} files
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onUploadClick(folder.id);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

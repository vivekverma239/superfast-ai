"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FolderPlus, FolderOpen, FileText, Calendar } from "lucide-react";
import { workerRequest } from "@/lib/worker";
import Link from "next/link";

type Folder = {
  id: string;
  name: string;
  createdAt: number;
  fileCount?: number;
};

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const data = await workerRequest<Folder[]>("/api/folders");
      setFolders(data);
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreating(true);
    try {
      const newFolder = await workerRequest<Folder>("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      setFolders([newFolder, ...folders]);
      setNewFolderName("");
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading folders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Your Folders</h1>
            <p className="text-muted-foreground mt-2">
              Organize your documents and start conversations
            </p>
          </div>
          <Button size="lg" onClick={handleCreateClick}>
            <FolderPlus className="h-5 w-5 mr-2" />
            New Folder
          </Button>
        </div>

        {/* Folders Grid */}
        {folders.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No folders yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first folder to start organizing your documents
            </p>
            <Button size="lg" onClick={handleCreateClick}>
              <FolderPlus className="h-5 w-5 mr-2" />
              Create Folder
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folders.map((folder) => (
              <Link href={`/folders/${folder.id}/files`} key={folder.id}>
                <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <FolderOpen className="h-8 w-8 text-blue-500 group-hover:text-blue-600 transition-colors" />
                    <div className="text-right">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 mr-1" />
                        {folder.fileCount || 0} files
                      </div>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                    {folder.name}
                  </h3>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    Created {formatDate(folder.createdAt)}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  createFolder();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewFolderName("");
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={createFolder}
              disabled={!newFolderName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

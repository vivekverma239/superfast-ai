import { ReactNode } from "react";
import Link from "next/link";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Folder } from "@/types";
import { serverRequest } from "@/lib/server";
import { FolderSidebar } from "@/components/folder-sidebar";

interface FolderLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function FolderLayout({
  children,
  params,
}: FolderLayoutProps) {
  const { id: folderId } = await params;

  // Fetch folder data on the server
  let folder: Folder;
  try {
    folder = await serverRequest<Folder>(`/api/folders/${folderId}`);
  } catch (error) {
    console.error("Error fetching folder:", error);
    // If folder not found, redirect to folders page
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Folder not found</h2>
          <p className="text-muted-foreground mb-4">
            The folder you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/folders"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Folders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <FolderSidebar
        folderId={folderId}
        folderName={folder.name}
        fileCount={folder.fileCount || 0}
      />
      <SidebarInset>
        <div className="flex h-full flex-col">
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

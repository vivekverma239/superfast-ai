"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Upload, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { AuthButtons } from "@/components/auth-buttons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./ui/sidebar";

interface FolderSidebarProps {
  folderId: string;
  folderName: string;
  fileCount: number;
}

const folderNavItems = [
  {
    title: "Files",
    value: "files",
    icon: FileText,
  },
  {
    title: "Chats",
    value: "chat",
    icon: MessageSquare,
  },
];

export function FolderSidebar({
  folderId,
  folderName,
  fileCount,
}: FolderSidebarProps) {
  const pathname = usePathname();
  const { open } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          {open && (
            <Link href="/folders">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Logo iconOnly={!open} />
        </div>
        {open && (
          <div className="px-2">
            <h2 className="font-semibold text-sm truncate">{folderName}</h2>
            <p className="text-xs text-muted-foreground">
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {open && <SidebarGroupLabel>Folder Options</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {folderNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/folders/${folderId}/${item.value}`}
                    tooltip={item.title}
                  >
                    <Link href={`/folders/${folderId}/${item.value}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2">
              <Button onClick={onUploadClick} size="sm" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup> */}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2">
          <AuthButtons />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

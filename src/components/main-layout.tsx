import { ReactNode } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MainSidebar } from "@/components/main-sidebar";
import { headers } from "next/headers";

interface MainLayoutProps {
  children: ReactNode;
}

export async function MainLayout({ children }: MainLayoutProps) {
  // get the pathname from the headers
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  // If folder detail page don't show the sidebar
  if (pathname.match(/^\/folders\/[^\/]+\//)) {
    console.debug("Folder detail page, don't show the sidebar");
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <MainSidebar />
      <SidebarInset>
        <div className="flex h-full flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MainSidebar } from "@/components/main-sidebar";
import { ProtectedRoute } from "@/components/protected-route";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If it's the login page, don't wrap with ProtectedRoute
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // If folder detail page don't show the sidebar
  if (mounted && pathname.match(/^\/folders\/[^\/]+\//)) {
    console.debug("Folder detail page, don't show the sidebar");
    return <ProtectedRoute>{children}</ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
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
    </ProtectedRoute>
  );
}

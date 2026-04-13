"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { PageChrome } from "./PageChrome";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:flex-nowrap sm:py-0">
          <div className="flex shrink-0 items-center gap-3">
            <SidebarTrigger className="-ml-1 size-8 rounded-md transition-colors hover:bg-muted" />
            <div className="hidden h-4 w-px shrink-0 bg-border sm:block" />
          </div>
          <PageChrome />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

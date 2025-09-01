'use client'

import React from "react"
import { AppSidebar } from "@/app/dashboard/app-sidebar"
import { SiteHeader } from "@/app/dashboard/site-header"
import { LoadingBar } from "@/app/dashboard/loading-bar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isChat = pathname?.startsWith("/dashboard/chat")
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
      className="group/layout h-svh overflow-hidden"
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-h-0 overflow-hidden">
        <LoadingBar />
        <SiteHeader />
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className={cn("@container/main flex flex-1 min-h-0 flex-col", isChat ? "gap-0" : "gap-2") }>
            <div className={cn("flex flex-1 min-h-0 flex-col", isChat ? "gap-4 py-0" : "gap-4 py-4 md:gap-6 md:py-6") }>
              <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
                {children}
              </React.Suspense>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
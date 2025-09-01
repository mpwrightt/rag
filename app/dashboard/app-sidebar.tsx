"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconMessageCircle,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconSparkles,
  IconBrandOpenai,
  IconBell,
  IconApi,
  IconCloud,
  IconPalette,
  IconShare,
  IconDownload,
  IconUpload,
  IconBrain,
  IconRobot,
  IconHistory
} from "@tabler/icons-react"

import { NavDocuments } from "@/app/dashboard/nav-documents"
import { NavMain } from "@/app/dashboard/nav-main"
import { NavSecondary } from "@/app/dashboard/nav-secondary"
import { NavUser } from "@/app/dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChatMaxingIconColoured } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
      badge: "Analytics"
    },
    {
      title: "AI Chat",
      url: "/dashboard/chat",
      icon: IconMessageCircle,
      badge: "Unified"
    },
    {
      title: "Documents",
      url: "/dashboard/documents",
      icon: IconFileDescription,
      badge: "Smart Upload"
    },
    {
      title: "Collections",
      url: "/dashboard/collections",
      icon: IconDatabase,
      badge: "Organize"
    },
    {
      title: "Prompts Library",
      url: "/dashboard/prompts",
      icon: IconBrain,
      badge: "AI Enhanced"
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: IconChartBar,
    },
    {
      title: "Integrations",
      url: "/dashboard/integrations",
      icon: IconApi,
      badge: "Connect"
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: IconBell,
    },
  ],
  navSecondary: [
    {
      title: "Search Everything",
      url: "/dashboard/search",
      icon: IconSearch,
    },
    {
      title: "User Profile",
      url: "/dashboard/profile",
      icon: IconUsers,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: IconSettings,
    },
    {
      title: "Help & Support",
      url: "/dashboard/help",
      icon: IconHelp,
    },
  ],
  documents: [
    {
      name: "Team Spaces",
      url: "/dashboard/teams",
      icon: IconUsers,
    },
    {
      name: "Export/Backup",
      url: "/dashboard/export",
      icon: IconDownload,
    },
    {
      name: "API Usage",
      url: "/dashboard/api-usage",
      icon: IconApi,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <ChatMaxingIconColoured className="!size-6" />
                <span className="text-base font-semibold">DataDiver</span>
                <Badge variant="outline" className="text-muted-foreground text-xs">RAG AI</Badge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

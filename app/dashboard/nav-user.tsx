"use client"

import { IconDotsVertical, IconLogout, IconSettings, IconUser } from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import { useClerk, useUser } from "@clerk/nextjs"
import { dark } from '@clerk/themes'

export function NavUser() {
  const { isMobile } = useSidebar()
  const { openUserProfile, signOut } = useClerk()
  const { user: clerkUser } = useUser();

  const appearance = {
    baseTheme: dark,
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={clerkUser?.imageUrl || ""} alt={clerkUser?.fullName || ""} />
                <AvatarFallback className="rounded-lg">
                  {clerkUser?.fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{clerkUser?.fullName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {clerkUser?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={clerkUser?.imageUrl || ""} alt={clerkUser?.fullName || ""} />
                  <AvatarFallback className="rounded-lg">
                    {clerkUser?.fullName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{clerkUser?.fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {clerkUser?.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openUserProfile({ appearance })}>
              <IconUser className="mr-2 h-4 w-4" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ redirectUrl: "/" })}
              className="text-red-600 dark:text-red-400"
            >
              <IconLogout className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

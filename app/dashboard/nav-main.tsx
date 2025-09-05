"use client"

import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"
import { usePathname, useRouter } from "next/navigation"
import { useOptimistic, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [optimisticPath, setOptimisticPath] = useOptimistic(pathname)
  const [isPending, startTransition] = useTransition()

  const handleQuickCreate = () => {
    startTransition(() => {
      setOptimisticPath('/dashboard/prompts')
      router.push('/dashboard/prompts?create=1')
    })
  }

  const handleNavigation = (url: string) => {
    startTransition(() => {
      setOptimisticPath(url)
      router.push(url)
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2" data-pending={isPending ? "" : undefined}>
        {/* New Prompt button */}
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2 mb-4">
            <SidebarMenuButton
              tooltip="New Prompt"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear touch-manipulation min-h-11 sm:min-h-10"
              onClick={handleQuickCreate}
            >
              <IconCirclePlusFilled className="w-5 h-5" />
              <span className="text-sm">New Prompt</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-10 group-data-[collapsible=icon]:opacity-0 touch-manipulation min-h-11 min-w-11 sm:size-8 sm:min-h-8 sm:min-w-8"
              variant="outline"
            >
              <IconMail />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Main navigation items */}
        <SidebarMenu>
          {items.map((item) => {
            // Use optimistic path for instant feedback
            const isActive = optimisticPath === item.url || (optimisticPath === '/dashboard' && item.url === '/dashboard')
            
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  tooltip={item.title}
                  isActive={isActive}
                  onClick={() => handleNavigation(item.url)}
                  className="touch-manipulation min-h-11 sm:min-h-10"
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

"use client"

import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { dark } from '@clerk/themes'
import { SidebarTrigger } from "@/components/ui/sidebar"

function getPageTitle(pathname: string): string {
  // Handle exact matches first
  switch (pathname) {
    case "/dashboard":
      return "Dashboard"
    case "/dashboard/payment-gated":
      return "Payment gated"
    default:
      return "Page"
  }
}

export function SiteHeader() {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  const appearance = {
    baseTheme: dark,
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) touch-manipulation">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {/* Mobile sidebar trigger - only show on mobile/tablet */}
        <SidebarTrigger className="sm:hidden mr-2 min-h-[44px] min-w-[44px] touch-manipulation" />
        <h1 className="text-base font-medium truncate">{pageTitle}</h1>
        <div className="ml-auto">
          <UserButton 
            appearance={appearance}
            userProfileProps={{
              appearance: {
                elements: {
                  rootBox: "touch-manipulation"
                }
              }
            }}
          />
        </div>
      </div>
    </header>
  )
}

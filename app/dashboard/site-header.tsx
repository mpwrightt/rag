"use client"

import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { dark } from '@clerk/themes'

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
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <h1 className="text-base font-medium">{pageTitle}</h1>
        <div className="ml-auto">
          <UserButton appearance={appearance} />
        </div>
      </div>
    </header>
  )
}

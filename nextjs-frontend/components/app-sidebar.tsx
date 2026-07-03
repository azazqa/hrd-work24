"use client"

import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { navMain } from "@/lib/nav-data"
import { NoticeFooter } from "@/components/notice-footer"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NoticeFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

"use client"

import { usePathname } from "next/navigation"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { usePermissions } from "@/lib/permissions"

function isSectionActive(pathname: string, item: { url: string; items?: { url: string }[] }): boolean {
  if (item.url !== "#" && (pathname === item.url || pathname.startsWith(item.url + "/"))) return true
  return (item.items ?? []).some((sub) => sub.url !== "#" && (pathname === sub.url || pathname.startsWith(sub.url + "/")))
}

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    resource?: string
    icon?: LucideIcon
    isActive?: boolean
    hasChildren?: boolean
    items?: {
      title: string
      url: string
      resource?: string
    }[]
  }[]
}) {
  const pathname = usePathname()
  const { can } = usePermissions()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>BDF-ERP</SidebarGroupLabel>
      <SidebarMenu>
        {items
          .map((item) => {
            const visibleChildren = (item.items ?? []).filter(
              (sub) => !sub.resource || can(sub.resource, "read"),
            )

            // If this section has children but none are visible, hide the parent section.
            if (item.hasChildren && item.url === "#" && visibleChildren.length === 0) {
              return null
            }

            // If parent has its own resource, enforce read permission on it too.
            if (item.resource && !can(item.resource, "read")) {
              return null
            }

            return { item, visibleChildren }
          })
          .filter((x): x is { item: (typeof items)[number]; visibleChildren: { title: string; url: string; resource?: string }[] } => x !== null)
          .map(({ item, visibleChildren }) =>
            item.hasChildren ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive ?? isSectionActive(pathname, item)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} className="font-bold">
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {visibleChildren.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <a href={subItem.url}>
                              <span>{subItem.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild className="font-bold">
                <a href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
          )}
      </SidebarMenu>
    </SidebarGroup>
  )
}

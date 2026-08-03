import { BookMarked, BookOpen, Calculator, House, Users, type LucideIcon } from "lucide-react"

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  hasChildren?: boolean
  superuserOnly?: boolean
  items?: { title: string; url: string }[]
}

export const navMain: NavItem[] = [
  {
    title: "홈",
    url: "/",
    icon: House,
    hasChildren: false,
  },
  {
    title: "과정 조회",
    url: "/courses",
    icon: BookOpen,
    hasChildren: false,
  },
  {
    title: "보유 과정",
    url: "/owned-courses",
    icon: BookMarked,
    hasChildren: false,
  },
  {
    title: "정산",
    url: "/settlements",
    icon: Calculator,
    hasChildren: true,
    items: [
      {
        title: "정산 목록",
        url: "/settlements",
      },
      {
        title: "고객사 맵핑",
        url: "/settlements/mappings",
      },
      {
        title: "보유과정 비교",
        url: "/settlements/compare",
      },
    ],
  },
  {
    title: "관리자",
    url: "#",
    icon: Users,
    hasChildren: true,
    superuserOnly: true,
    items: [
      {
        title: "스케줄 관리",
        url: "/admin/scheduler",
      },
      {
        title: "과정 색인",
        url: "/admin/courses",
      },
      {
        title: "API 조회 로그",
        url: "/admin/api-logs",
      },
    ],
  },
]

export function getPageTitle(pathname: string): string {
  for (const item of navMain) {
    if (item.url !== "#" && item.url === pathname) return item.title
    if (item.items) {
      for (const sub of item.items) {
        if (sub.url !== "#" && sub.url === pathname) return sub.title
      }
    }
    if (item.url !== "#" && item.url !== "/" && pathname.startsWith(item.url + "/")) {
      return item.title
    }
  }
  return ""
}

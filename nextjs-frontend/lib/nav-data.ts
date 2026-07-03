import { House, Package, ShoppingCart, Warehouse, Users, Receipt, type LucideIcon } from "lucide-react"

export interface NavItem {
  title: string
  url: string
  resource?: string
  icon?: LucideIcon
  isActive?: boolean
  hasChildren?: boolean
  items?: { title: string; url: string; resource?: string }[]
}

export const navMain: NavItem[] = [
  {
    title: "대시보드",
    url: "/dashboard",
    resource: "dashboard",
    icon: House,
    hasChildren: false,
  },
  {
    title: "상품",
    url: "#",
    icon: Package,
    hasChildren: true,
    items: [
      {
        title: "상품 관리",
        url: "/products",
        resource: "products",
      },
      {
        title: "상품 카테고리 관리",
        url: "/categories",
        resource: "categories",
      },
      {
        title: "상품 별칭 관리",
        url: "/product-alias-dicts",
        resource: "product_alias_dicts",
      },
    ],
  },
  {
    title: "재고",
    url: "#",
    icon: Warehouse,
    hasChildren: true,
    items: [
      {
        title: "재고 대시보드",
        url: "/stocks/dashboard",
        resource: "dashboard",
      },
      {
        title: "재고 관리",
        url: "/stocks",
        resource: "stocks",
      },
      {
        title: "재고 이력",
        url: "/stocks/histories",
        resource: "stocks_histories",
      },
      {
        title: "물류지 관리",
        url: "/logistics-locations",
        resource: "logistics_locations",
      },
    ],
  },
  {
    title: "주문",
    url: "#",
    icon: ShoppingCart,
    hasChildren: true,
    items: [
      {
        title: "채널 관리",
        url: "/channels",
        resource: "channels",
      },
      {
        title: "택배사 관리",
        url: "/couriers",
        resource: "couriers",
      },
      {
        title: "주문 관리",
        url: "/orders",
        resource: "orders",
      },
      {
        title: "배송 관리",
        url: "/shipments",
        resource: "shipments",
      },
      {
        title: "수취인 관리",
        url: "/receivers",
        resource: "receivers",
      },
    ],
  },
  {
    title: "정산",
    url: "#",
    icon: Receipt,
    hasChildren: true,
    items: [
      {
        title: "정산 관리",
        url: "/settlements",
        resource: "settlements",
      },
    ],
  },
  {
    title: "관리자",
    url: "#",
    icon: Users,
    hasChildren: true,
    items: [
      {
        title: "사용자 관리",
        url: "/admin/users",
        resource: "admin_users",
      },
      {
        title: "권한 관리",
        url: "/admin/permissions",
        resource: "admin_permissions",
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

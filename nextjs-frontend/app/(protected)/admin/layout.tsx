import { notFound } from "next/navigation";

import { getServerIsSuperuser } from "@/lib/permissions-server";

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await getServerIsSuperuser();
  if (!ok) {
    notFound();
  }
  return <>{children}</>;
}

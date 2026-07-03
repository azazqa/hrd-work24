import { proxyAdminRequest } from "@/lib/admin-api-proxy";

export async function POST(request: Request) {
  return proxyAdminRequest(request, "/courses/index");
}

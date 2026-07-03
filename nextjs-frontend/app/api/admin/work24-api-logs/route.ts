import { proxyAdminRequest } from "@/lib/admin-api-proxy";

export async function GET(request: Request) {
  return proxyAdminRequest(request, "/admin/work24-api-logs");
}

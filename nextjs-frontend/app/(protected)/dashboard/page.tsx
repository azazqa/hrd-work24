import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cookies } from "next/headers";
import { StockByProductPanel } from "./stock-by-product-panel";
import { Label } from "@/components/ui/label";

type OrderStatus = "order" | "shipping_waiting" | "shipping";

type StockSummaryRow = {
  product_id: string;
  condition: "normal" | "refurb" | "disposal" | "undecided";
  quantity: number;
  batch_code?: string | null;
  expiration_date: string;
  product?: { product_code: string; name: string } | null;
};

async function fetchStockSummaryRows(): Promise<StockSummaryRow[] | { message: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return { message: "No access token found" };

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const res = await fetch(`${baseURL}/stocks/summary/by-product-and-condition`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return { message: `Failed to load stock summary (HTTP ${res.status})` };
  }

  const rows = (await res.json()) as StockSummaryRow[];
  return Array.isArray(rows) ? rows : [];
}

function ymdInSeoul(d: Date): string {
  // en-CA yields YYYY-MM-DD
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

async function fetchOrderCountByDateAndStatus(args: {
  dateYmd: string;
  status: OrderStatus;
}): Promise<number | { message: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return { message: "No access token found" };

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/orders/`);
  url.searchParams.set("page", "1");
  url.searchParams.set("size", "1");
  url.searchParams.set("status", args.status);
  url.searchParams.set("order_date_start", args.dateYmd);
  url.searchParams.set("order_date_end", args.dateYmd);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return { message: `Failed to load order counts (HTTP ${res.status})` };
  }
  const data = (await res.json()) as { total?: number };
  return typeof data.total === "number" ? data.total : 0;
}

export default async function DashboardPage() {
  const summaryRows = await fetchStockSummaryRows();
  const today = ymdInSeoul(new Date());
  const yesterday = ymdInSeoul(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const statuses: Array<{ status: OrderStatus; label: string }> = [
    { status: "order", label: "주문" },
    { status: "shipping_waiting", label: "배송 대기" },
    { status: "shipping", label: "배송" },
  ];

  const [yCounts, tCounts] = await Promise.all([
    Promise.all(
      statuses.map(async (s) => ({
        ...s,
        count: await fetchOrderCountByDateAndStatus({ dateYmd: yesterday, status: s.status }),
      })),
    ),
    Promise.all(
      statuses.map(async (s) => ({
        ...s,
        count: await fetchOrderCountByDateAndStatus({ dateYmd: today, status: s.status }),
      })),
    ),
  ]);

  const yError = yCounts.find((x) => typeof x.count !== "number")?.count as { message: string } | undefined;
  const tError = tCounts.find((x) => typeof x.count !== "number")?.count as { message: string } | undefined;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2 lg:mb-4">
        <Card>
          <CardHeader>
            <CardTitle>전일 주문</CardTitle>
            <CardDescription>{yesterday}</CardDescription>
          </CardHeader>
          <CardContent>
            {yError ? (
              <p className="text-sm text-red-500">{yError.message}</p>
            ) : (
              <div className="flex flex-row items-center justify-between space-y-1 text-sm">
                {yCounts.map((r) => (
                  <div key={r.status} className="flex flex-col">
                    <Label className="text-muted-foreground">{r.label}</Label>
                    <p className="text-2xl font-semibold tabular-nums">
                      {(r.count as number).toLocaleString("ko-KR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>금일 주문</CardTitle>
            <CardDescription>{today}</CardDescription>
          </CardHeader>
          <CardContent>
            {tError ? (
              <p className="text-sm text-red-500">{tError.message}</p>
            ) : (
              <div className="flex flex-row items-center justify-between space-y-1 text-sm">
                {tCounts.map((r) => (
                  <div key={r.status} className="flex flex-col">
                    <Label className="text-muted-foreground">{r.label}</Label>
                    <p className="text-2xl font-semibold tabular-nums">
                      {(r.count as number).toLocaleString("ko-KR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle>상품별 재고</CardTitle>
          </CardHeader>
          <CardContent>
            {"message" in summaryRows ? (
              <p className="text-sm text-red-500">{summaryRows.message}</p>
            ) : (
              <StockByProductPanel initialRows={summaryRows} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

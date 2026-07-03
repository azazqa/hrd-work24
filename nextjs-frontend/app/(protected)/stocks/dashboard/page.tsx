import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StockByProductPanel } from "@/app/(protected)/dashboard/stock-by-product-panel";
import { LogisticsLocationFilter } from "./logistics-filter";
import {
  fetchStockSummaryByProductAndCondition,
} from "@/components/actions/stocks-action";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PageProps {
  searchParams: Promise<{ location?: string }>;
}

export default async function StocksDashboardPage({ searchParams }: PageProps) {
  const { location: locationParam } = await searchParams;
  const locationId =
    locationParam && locationParam.trim() ? locationParam.trim() : undefined;

  const [summaryResult] = await Promise.all([
    fetchStockSummaryByProductAndCondition(locationId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">
          재고 대시보드
          <Tooltip>
            <TooltipTrigger className="inline-block ml-2">
              <CircleHelp className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>물류지를 선택하면 해당 장소 기준 상품별 재고를 확인할 수 있습니다.</p>
            </TooltipContent>
          </Tooltip>
        </h2>
      </div>

      <Suspense
        fallback={
          <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
        }
      >
        <LogisticsLocationFilter />
      </Suspense>

      {"message" in summaryResult ? (
        <p className="text-sm text-destructive">{summaryResult.message}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>상품 상태별 재고 (상태·배치·유통기한)</CardTitle>
          </CardHeader>
          <CardContent>
            <StockByProductPanel
              initialRows={summaryResult}
              locationId={locationId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

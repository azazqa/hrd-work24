import { StockForm } from "@/app/(protected)/stocks/add/stock-form";
import { fetchProductsForStockSelect } from "@/components/actions/stocks-action";
import { fetchLogisticsLocationsForSelect } from "@/components/actions/logistics-locations-action";

export default async function CreateStockPage() {
  const products = await fetchProductsForStockSelect();
  const logisticsLocations = await fetchLogisticsLocationsForSelect();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            입고 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            상품의 재고를 등록해주세요.
          </p>
        </header>
        <StockForm products={products} logisticsLocations={logisticsLocations} />
      </div>
    </div>
  );
}

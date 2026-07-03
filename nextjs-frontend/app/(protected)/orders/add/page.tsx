import { OrderForm } from "@/app/(protected)/orders/add/order-form";

export const dynamic = "force-dynamic";

export default async function CreateOrderPage() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            주문 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            주문 정보와 수취인 정보를 함께 입력해주세요.
          </p>
        </header>
        <OrderForm />
      </div>
    </div>
  );
}

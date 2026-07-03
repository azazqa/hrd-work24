import { OrderExcelUpload } from "@/app/(protected)/orders/upload/upload-form";

export const dynamic = "force-dynamic";

export default function OrderUploadPage() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="w-full mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            새 주문 업로드
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            엑셀 파일을 업로드하고, 상품 매칭을 확인한 뒤 주문을 저장합니다.
          </p>
        </header>
        <OrderExcelUpload />
      </div>
    </div>
  );
}


import { ChannelForm } from "../channel-form";
import { fetchCouriersForSelect } from "@/components/actions/couriers-action";

export default async function CreateChannelPage() {
  const couriers = await fetchCouriersForSelect();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            채널 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            새로운 판매 채널 정보를 입력해주세요.
          </p>
        </header>

        <ChannelForm couriers={couriers} />
      </div>
    </div>
  );
}

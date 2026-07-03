import { notFound } from "next/navigation";
import Link from "next/link";
import { ChannelForm } from "../../channel-form";
import { fetchCouriersForSelect } from "@/components/actions/couriers-action";
import { fetchChannelById } from "@/components/actions/channels-action";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export default async function EditChannelPage({ params }: Props) {
  const { id } = await params;
  const [couriers, channelRes] = await Promise.all([
    fetchCouriersForSelect(),
    fetchChannelById(id),
  ]);

  if (!channelRes || "message" in channelRes) {
    notFound();
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
              채널 수정
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              채널 정보를 수정합니다.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/channels">목록</Link>
          </Button>
        </header>

        <ChannelForm
          mode="edit"
          channelId={id}
          initial={channelRes}
          couriers={couriers}
        />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";

import { fetchOwnedCourse } from "@/components/actions/owned-courses-action";

import { OwnedCourseForm } from "../../owned-course-form";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnedCourseEditPage({ params }: EditPageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const course = await fetchOwnedCourse(id);
  if ("message" in course) {
    notFound();
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold">보유 과정 수정</h2>
      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <OwnedCourseForm mode="edit" courseId={id} initial={course} />
      </section>
    </div>
  );
}

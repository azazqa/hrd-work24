import { OwnedCourseForm } from "../owned-course-form";

export default function OwnedCourseAddPage() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold">보유 과정 등록</h2>
      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <OwnedCourseForm mode="create" />
      </section>
    </div>
  );
}

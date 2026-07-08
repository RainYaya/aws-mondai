/**
 * app/page.tsx
 *
 * Home page — displays all available exams as cards with
 * exam name, question count, and topic tags.
 *
 * Reads manifest.json directly at build time (SSG).
 */

import { loadManifest } from "@/lib/data-loader";
import { ExamCardGrid } from "@/components/exam-card-grid";

export default function HomePage() {
  const manifest = loadManifest();

  if (!manifest || manifest.exams.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-gray-900">AWS Mondai</h1>
        <p className="mt-2 text-gray-500">
          まだ問題が登録されていません。
          <br />
          No questions available yet. Run <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-600">npm run process</code>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          AWS Mondai
        </h1>
        <p className="mt-2 text-gray-500">
          AWS 認定試験対策 — 双语刷题
        </p>
      </div>

      <ExamCardGrid exams={manifest.exams} />
    </div>
  );
}

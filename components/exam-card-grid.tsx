"use client";

/**
 * components/exam-card-grid.tsx
 *
 * Displays all exams as a grid of cards. Each card shows the exam name
 * (display name from manifest, or original name), question count, and topics.
 */

import Link from "next/link";
import type { ManifestExam } from "@/lib/types";

interface Props {
  exams: ManifestExam[];
}

export function ExamCardGrid({ exams }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {exams.map((exam) => (
        <Link
          key={exam.id}
          href={`/${exam.id}`}
          className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
            {exam.displayName}
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            {exam.questionCount} 問 / questions
          </p>
          {exam.topics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {exam.topics.slice(0, 5).map((topic) => (
                <span
                  key={topic}
                  className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                >
                  {topic}
                </span>
              ))}
              {exam.topics.length > 5 && (
                <span className="inline-block rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
                  +{exam.topics.length - 5}
                </span>
              )}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

"use client";

/**
 * components/question-list-content.tsx
 *
 * Client-side paginated list of questions for an exam.
 * Shows question number, text preview, and topic tags.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Question } from "@/lib/types";
import { blocksToText } from "@/lib/helpers";

const PAGE_SIZE = 20;

interface Props {
  examId: string;
  questions: Question[];
}

export function QuestionListContent({ examId, questions }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(questions.length / PAGE_SIZE);

  const pageQuestions = useMemo(
    () => questions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [questions, page],
  );

  return (
    <div>
      {/* Question list */}
      <div className="space-y-2">
        {pageQuestions.map((q, i) => {
          const globalIndex = (page - 1) * PAGE_SIZE + i + 1;
          const preview = blocksToText(q.content.questionBlocks).slice(0, 80);
          const topics = q.content.studyTextSections.map((s) => s.title);

          return (
            <Link
              key={q.metadata.questionId}
              href={`/${examId}/${q.metadata.questionId}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500">
                  {globalIndex}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-gray-700">
                    {preview || "(No text content)"}
                  </p>
                  {topics.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {topics.map((t) => (
                        <span
                          key={t}
                          className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <svg
                  className="mt-1 size-4 shrink-0 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Empty state */}
      {pageQuestions.length === 0 && (
        <div className="flex min-h-[30vh] items-center justify-center text-gray-500">
          No questions found on this page.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>

          <span className="px-3 text-sm text-gray-500">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

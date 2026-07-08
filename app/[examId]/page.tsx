/**
 * app/[examId]/page.tsx
 *
 * Browse list page — shows all questions for an exam with pagination.
 * Each row shows the question number, a text preview, and topic badges.
 *
 * Generates one page per exam (SSG via generateStaticParams).
 * Uses client-side pagination for the question list.
 */

import Link from "next/link";
import { loadManifest, loadExamQuestions, findExamMeta } from "@/lib/data-loader";
import { QuestionListContent } from "@/components/question-list-content";
import { notFound } from "next/navigation";

// ─── SSG params ─────────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ examId: string }[]> {
  const manifest = loadManifest();
  if (!manifest) return [];
  return manifest.exams.map((exam) => ({ examId: exam.id }));
}

// ─── Page component ─────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function ExamListPage({ params }: Props) {
  const { examId } = await params;
  const manifest = loadManifest();

  if (!manifest) {
    notFound();
  }

  const examMeta = findExamMeta(examId, manifest);
  const questions = loadExamQuestions(examId);

  if (!questions || !examMeta) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg
            className="mr-1 size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to exams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{examMeta.displayName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {examMeta.questionCount} 問 / questions
        </p>
      </div>

      <QuestionListContent examId={examId} questions={questions} />
    </div>
  );
}

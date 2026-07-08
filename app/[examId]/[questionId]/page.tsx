/**
 * app/[examId]/[questionId]/page.tsx
 *
 * Question detail page — SSG pre-rendered for every question.
 * Displays full question with bilingual support (review mode).
 * URL is shareable.
 */

import Link from "next/link";
import { loadManifest, loadExamQuestions } from "@/lib/data-loader";
import type { Question } from "@/lib/types";
import { blocksToText } from "@/lib/helpers";
import { QuestionDetailContent } from "@/components/question-detail-content";
import { BookmarkButton } from "@/components/bookmark-button";
import { notFound } from "next/navigation";

// ─── Data loading ───────────────────────────────────────────────────────────

// loadManifest and loadExamQuestions come from lib/data-loader

// ─── SSG params ─────────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<
  { examId: string; questionId: string }[]
> {
  const manifest = loadManifest();
  if (!manifest) return [];

  const params: { examId: string; questionId: string }[] = [];

  for (const exam of manifest.exams) {
    const questions = loadExamQuestions(exam.id);
    if (!questions) continue;
    for (const q of questions) {
      params.push({ examId: exam.id, questionId: q.metadata.questionId });
    }
  }

  return params;
}

// ─── Page component ─────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ examId: string; questionId: string }>;
}

export default async function QuestionDetailPage({ params }: Props) {
  const { examId, questionId } = await params;
  const questions = loadExamQuestions(examId);

  if (!questions) {
    notFound();
  }

  const question = questions.find((q) => q.metadata.questionId === questionId);

  if (!question) {
    notFound();
  }

  // Build prev/next for navigation
  const currentIndex = questions.findIndex(
    (q) => q.metadata.questionId === questionId,
  );
  const prevQuestion = currentIndex > 0 ? questions[currentIndex - 1] : null;
  const nextQuestion =
    currentIndex < questions.length - 1 ? questions[currentIndex + 1] : null;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700">
          Home
        </Link>
        <span>/</span>
        <Link href={`/${examId}`} className="hover:text-gray-700">
          {examId.toUpperCase()}
        </Link>
        <span>/</span>
        <span className="text-gray-900">
          #{currentIndex + 1}
        </span>
      </nav>

      {/* Question header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {question.metadata.questionType === "multiple" ? "Multiple" : "Single"}
          </span>
          <span className="text-sm text-gray-400">
            ID: {question.metadata.questionId}
          </span>
          <div className="flex-1" />
          <BookmarkButton examId={examId} questionId={question.metadata.questionId} />
        </div>
      </div>

      <QuestionDetailContent question={question} />

      {/* Prev / Next navigation */}
      <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-6">
        {prevQuestion ? (
          <Link
            href={`/${examId}/${prevQuestion.metadata.questionId}`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">
              {blocksPreview(prevQuestion.content.questionBlocks)}
            </span>
            <span className="sm:hidden">Previous</span>
          </Link>
        ) : (
          <div />
        )}

        {nextQuestion ? (
          <Link
            href={`/${examId}/${nextQuestion.metadata.questionId}`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            <span className="hidden sm:inline">
              {blocksPreview(nextQuestion.content.questionBlocks)}
            </span>
            <span className="sm:hidden">Next</span>
            <svg
              className="size-4"
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
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

// ─── Helper: extract a short preview from question blocks ───────────────────

function blocksPreview(blocks: Question["content"]["questionBlocks"]): string {
  const text = blocksToText(blocks);
  return text.length > 30 ? text.slice(0, 30) + "…" : text;
}

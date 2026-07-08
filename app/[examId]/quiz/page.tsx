/**
 * app/[examId]/quiz/page.tsx
 *
 * Quiz configuration page — user selects question count and mode,
 * then starts the quiz. SSG pre-rendered for each exam.
 */

import Link from "next/link";
import { loadManifest, loadExamQuestions, findExamMeta } from "@/lib/data-loader";
import { QuizConfigForm } from "./quiz-config-form";
import { notFound } from "next/navigation";

// ─── SSG params ─────────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ examId: string }[]> {
  const manifest = loadManifest();
  if (!manifest) return [];
  return manifest.exams.map((exam) => ({ examId: exam.id }));
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function QuizConfigPage({ params }: Props) {
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
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700">
          Home
        </Link>
        <span>/</span>
        <Link href={`/${examId}`} className="hover:text-gray-700">
          {examMeta.displayName}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Quiz</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">刷题 / Quiz</h1>
        <p className="mt-1 text-sm text-gray-500">
          {examMeta.displayName} — {examMeta.questionCount} questions available
        </p>
      </div>

      <QuizConfigForm
        examId={examId}
        totalQuestions={questions.length}
      />
    </div>
  );
}

/**
 * app/[examId]/quiz/session/page.tsx
 *
 * Quiz session page — the main answering interface.
 * SSG pre-rendered per exam. The session is loaded client-side
 * from localStorage via QuizProvider.
 */

import { loadManifest, findExamMeta } from "@/lib/data-loader";
import { QuizSessionView } from "./quiz-session-view";
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

export default async function QuizSessionPage({ params }: Props) {
  const { examId } = await params;
  const manifest = loadManifest();

  if (!manifest) notFound();

  const examMeta = findExamMeta(examId, manifest);
  if (!examMeta) notFound();

  return <QuizSessionView examId={examId} examName={examMeta.displayName} />;
}

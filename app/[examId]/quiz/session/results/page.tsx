/**
 * app/[examId]/quiz/session/results/page.tsx
 *
 * Results summary page — shows score, accuracy, per-question table,
 * and action buttons. SSG pre-rendered per exam.
 * Session data is loaded client-side from QuizProvider.
 */

import { loadManifest, findExamMeta } from "@/lib/data-loader";
import { ResultsView } from "./results-view";
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

export default async function ResultsPage({ params }: Props) {
  const { examId } = await params;
  const manifest = loadManifest();

  if (!manifest) notFound();

  const examMeta = findExamMeta(examId, manifest);
  if (!examMeta) notFound();

  return <ResultsView examId={examId} />;
}

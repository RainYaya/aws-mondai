/**
 * app/[examId]/quiz/results/page.tsx
 *
 * Results summary page — SSG pre-rendered per exam.
 * Shows score, per-question breakdown, and retry actions.
 */

import { loadManifest, findExamMeta } from "@/lib/data-loader";
import { ResultsView } from "./results-view";
import { notFound } from "next/navigation";

export async function generateStaticParams(): Promise<{ examId: string }[]> {
  const manifest = loadManifest();
  if (!manifest) return [];
  return manifest.exams.map((exam) => ({ examId: exam.id }));
}

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { examId } = await params;
  const manifest = loadManifest();

  if (!manifest) notFound();
  const examMeta = findExamMeta(examId, manifest);
  if (!examMeta) notFound();

  return <ResultsView examId={examId} examName={examMeta.displayName} />;
}

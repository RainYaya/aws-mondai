"use client";

/**
 * app/[examId]/quiz/layout.tsx
 *
 * Layout for quiz routes — wraps children with QuizProvider
 * scoped to the current exam. Must be "use client" because
 * QuizProvider is a client component.
 */

import { useParams } from "next/navigation";
import { QuizProvider } from "@/lib/quiz-context";

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const examId = params.examId as string;

  return <QuizProvider examId={examId}>{children}</QuizProvider>;
}

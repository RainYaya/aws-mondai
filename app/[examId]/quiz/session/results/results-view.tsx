"use client";

/**
 * app/[examId]/quiz/session/results/results-view.tsx
 *
 * Client-side results summary: stats card, per-question results table,
 * action buttons. Session and questions are loaded by the parent QuizProvider.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useQuiz } from "@/lib/quiz-context";
import { useLanguage } from "@/lib/language-context";
import { getCorrectValues } from "@/lib/quiz-engine";
import { blocksToText } from "@/lib/helpers";

interface Props {
  examId: string;
}

export function ResultsView({ examId }: Props) {
  const { lang } = useLanguage();
  const {
    session,
    questions,
    finishSession,
    loading,
    error,
    hydrated,
  } = useQuiz();

  // Auto-complete session when viewing results
  useEffect(() => {
    if (session && !session.completedAt) {
      finishSession();
    }
  }, [session?.sessionId]);

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-gray-400">Loading results…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-lg text-red-500">Failed to load exam data.</p>
        <p className="mt-1 text-sm text-gray-400">{error}</p>
        <Link
          href={`/${examId}/quiz`}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to quiz config
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-lg text-gray-500">No session data found.</p>
        <Link
          href={`/${examId}/quiz`}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start a new quiz
        </Link>
      </div>
    );
  }

  const total = session.config.totalCount;
  const answers = Object.values(session.answers);
  const correctCount = answers.filter((a) => a.correct).length;
  const incorrectCount = answers.filter((a) => !a.correct).length;
  const unansweredCount = total - correctCount - incorrectCount;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  // Time spent
  const timeMs = session.completedAt
    ? session.completedAt - session.startedAt
    : Date.now() - session.startedAt;
  const timeSeconds = Math.floor(timeMs / 1000);
  const timeMinutes = Math.floor(timeSeconds / 60);
  const timeRemainSecs = timeSeconds % 60;

  // Build question lookup map
  const questionMap = new Map(questions.map((q) => [q.metadata.questionId, q]));

  // Mistakes count for the "redo mistakes" button
  const mistakesCount = answers.filter((a) => !a.correct).length;

  // Grade
  let grade: string;
  let gradeColor: string;
  if (accuracy >= 90) { grade = "Excellent 🎉"; gradeColor = "text-green-600"; }
  else if (accuracy >= 70) { grade = "Good 👍"; gradeColor = "text-blue-600"; }
  else if (accuracy >= 50) { grade = "Keep Trying 💪"; gradeColor = "text-yellow-600"; }
  else { grade = "Needs Work 📚"; gradeColor = "text-red-600"; }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <Link
          href={`/${examId}/quiz`}
          className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="mr-1 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to quiz config
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Results / 结果</h1>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Score / 得分" value={`${correctCount}/${total}`} sub={`${accuracy}%`} />
        <StatCard label="Correct / 正确" value={String(correctCount)} color="text-green-600" />
        <StatCard label="Incorrect / 错误" value={String(incorrectCount)} color="text-red-600" />
        <StatCard
          label="Time / 用时"
          value={timeMinutes > 0 ? `${timeMinutes}m ${timeRemainSecs}s` : `${timeSeconds}s`}
        />
      </div>

      {/* Grade banner */}
      <div className={`rounded-xl border p-6 text-center ${accuracy >= 70 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
        <p className={`text-3xl font-bold ${gradeColor}`}>{grade}</p>
        <p className="mt-1 text-sm text-gray-500">
          {accuracy}% — {correctCount} of {total} correct
          {unansweredCount > 0 && ` (${unansweredCount} unanswered)`}
        </p>
      </div>

      {/* ── Results table ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Question / 题目</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Your Answer / 你的答案</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Correct / 正解</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {session.config.questionIds.map((qid, i) => {
              const answer = session.answers[qid];
              const question = questionMap.get(qid);
              const isCorrect = answer?.correct ?? false;
              const preview = question
                ? blocksToText(question.content.questionBlocks).slice(0, 50)
                : qid;

              // Format answer values to text
              const fmtValues = (values: string[]) =>
                values
                  .map((v) => {
                    const choice = question?.content.choices.find((c) => c.value === v);
                    return choice ? blocksToText(choice.blocks) : v;
                  })
                  .join(", ") || "—";

              const correctVals = question
                ? getCorrectValues(
                    question.content.choices.map((c) => ({ value: c.value, correct: c.correct })),
                  )
                : [];

              return (
                <tr key={qid} className={isCorrect ? "" : "bg-red-50/50"}>
                  <td className="px-4 py-3 font-medium text-gray-700">{i + 1}</td>
                  <td className="max-w-[200px] px-4 py-3">
                    {question ? (
                      <Link
                        href={`/${examId}/${question.metadata.questionId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {preview || "(No text)"}
                      </Link>
                    ) : (
                      <span className="text-gray-400">{qid}</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                    {answer ? fmtValues(answer.selectedValues) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                    {fmtValues(correctVals)}
                  </td>
                  <td className="px-4 py-3">
                    {answer ? (
                      isCorrect ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Wrong
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${examId}/quiz`}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Redo All / 重做全部
        </Link>
        {mistakesCount > 0 && (
          <Link
            href={`/${examId}/quiz`}
            className="rounded-lg border border-orange-300 bg-orange-50 px-6 py-2.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100"
          >
            Redo Mistakes / 只做错题 ({mistakesCount})
          </Link>
        )}
        <Link
          href={`/${examId}`}
          className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          Back to Browse / 返回题库
        </Link>
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQuiz } from "@/lib/quiz-context";
import { useLanguage } from "@/lib/language-context";
import { blocksToText } from "@/lib/helpers";
import { getResults } from "@/lib/quiz-engine";

interface Props {
  examId: string;
  examName: string;
}

export function ResultsView({ examId, examName }: Props) {
  const { lang } = useLanguage();
  const { session, questions, loading, hydrated, progress, clearSession } = useQuiz();

  if (loading || !hydrated) {
    return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-gray-400">Loading results...</p></div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-lg text-gray-500">No results to display.</p>
        <Link href={"/" + examId + "/quiz"} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Start a new quiz</Link>
      </div>
    );
  }

  const results = getResults(session);
  const total = progress.total;
  const correct = progress.correctCount;
  const incorrect = progress.incorrectCount;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const timeMs = session.completedAt
    ? session.completedAt - session.startedAt
    : Date.now() - session.startedAt;
  const timeMin = Math.floor(timeMs / 60000);
  const timeSec = Math.floor((timeMs % 60000) / 1000);

  let grade: string;
  let gradeColor: string;
  if (accuracy >= 90) { grade = "Excellent"; gradeColor = "text-green-600"; }
  else if (accuracy >= 70) { grade = "Good"; gradeColor = "text-blue-600"; }
  else if (accuracy >= 50) { grade = "Keep Trying"; gradeColor = "text-yellow-600"; }
  else { grade = "Needs Work"; gradeColor = "text-red-600"; }

  return (
    <div className="space-y-8">
      <div>
        <Link href={"/" + examId + "/quiz"} className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <svg className="mr-1 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to quiz config
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Results / 结果</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Score / 得分" value={correct + "/" + total} sub={accuracy + "%"} />
        <StatCard label="Correct / 正确" value={String(correct)} color="text-green-600" />
        <StatCard label="Incorrect / 错误" value={String(incorrect)} color="text-red-600" />
        <StatCard label="Time / 用时" value={timeMin > 0 ? timeMin + "m " + timeSec + "s" : timeSec + "s"} />
      </div>

      {/* Grade */}
      <div className={"rounded-xl border p-6 text-center " + (accuracy >= 70 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50")}>
        <p className={"text-3xl font-bold " + gradeColor}>{grade}</p>
        <p className="mt-1 text-sm text-gray-500">{accuracy}% — {correct} of {total} correct</p>
      </div>

      {/* Results table */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Question</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Your Answer</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r, i) => {
              const question = questions.find(q => q.metadata.questionId === r.questionId);
              if (!question) return null;
              const preview = blocksToText(question.content.questionBlocks).slice(0, 50);
              const userAnswerText = r.selectedValues.length > 0
                ? r.selectedValues.map(v => {
                    const choice = question.content.choices.find(c => c.value === v);
                    return choice ? blocksToText(choice.blocks) : v;
                  }).join(", ")
                : "—";
              const correctText = question.content.choices
                .filter(c => c.correct)
                .map(c => blocksToText(c.blocks))
                .join(", ");

              return (
                <tr key={r.questionId} className={r.correct ? "" : "bg-red-50/50"}>
                  <td className="px-4 py-3 font-medium text-gray-700">{i + 1}</td>
                  <td className="max-w-[200px] px-4 py-3">
                    <Link href={"/" + examId + "/" + r.questionId} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {preview || "(No text)"}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                    <span className={r.correct ? "" : "text-red-600"}>{userAnswerText}</span>
                    {!r.correct && <span className="ml-2 text-xs text-gray-400">({correctText})</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.correct ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        Wrong
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={"/" + examId + "/quiz"} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
          Redo All / 重做全部
        </Link>
        <Link href={"/" + examId} className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50">
          Back to Browse / 返回题库
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={"mt-1 text-2xl font-bold " + (color ?? "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
"use client";

/**
 * app/[examId]/quiz/quiz-config-form.tsx
 *
 * Client-side quiz configuration form.
 * User selects question count and mode, then starts the quiz.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuiz } from "@/lib/quiz-context";
import { getMistakes } from "@/lib/storage";

/**
 * Resume session modal — shown on mount when an unfinished session exists.
 */
function ResumeSessionModal({
  examId,
  onResume,
  onStartNew,
}: {
  examId: string;
  onResume: () => void;
  onStartNew: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">
          检测到未完成测验 / Unfinished Quiz
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          你有一个未完成的刷题会话，是否继续上次的进度？
          <br />
          You have an unfinished quiz session. Would you like to resume?
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            继续 / Resume
          </button>
          <button
            type="button"
            onClick={onStartNew}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            重新开始 / Start New
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  examId: string;
  totalQuestions: number;
}

const COUNT_OPTIONS = [10, 20, 50] as const;

export function QuizConfigForm({ examId, totalQuestions }: Props) {
  const router = useRouter();
  const { startSession, session, hydrated, clearSession } = useQuiz();
  const [count, setCount] = useState<number | "all">(10);
  const [mode, setMode] = useState<"original" | "random" | "mistakes">("original");
  const [starting, setStarting] = useState(false);
  const [dismissedResume, setDismissedResume] = useState(false);

  const hasUnfinished = hydrated && session !== null && session.completedAt === null && !dismissedResume;

  const effectiveCount = count === "all" ? totalQuestions : Math.min(count, totalQuestions);
  const mistakesCount = getMistakes(examId).length;
  const mistakesDisabled = mode === "mistakes" && mistakesCount === 0;

  function handleStart() {
    if (mistakesDisabled) return;
    setStarting(true);
    try {
      startSession({ count, mode });
      router.push(`/${examId}/quiz/session`);
    } catch (err) {
      console.error("Failed to start quiz:", err);
      setStarting(false);
    }
  }

  const hasActiveSession = session !== null && session.completedAt === null;

  function handleResume() {
    router.push(`/${examId}/quiz/session`);
  }

  function handleStartNew() {
    clearSession();
    setDismissedResume(true);
  }

  return (
    <>
      {hasUnfinished && (
        <ResumeSessionModal
          examId={examId}
          onResume={handleResume}
          onStartNew={handleStartNew}
        />
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Question count */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          题数 / Question Count
        </h2>
        <div className="flex flex-wrap gap-3">
          {COUNT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setCount(opt)}
              className={`rounded-lg border px-5 py-2.5 text-sm font-medium transition-all ${
                count === opt
                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt} 题
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCount("all")}
            className={`rounded-lg border px-5 py-2.5 text-sm font-medium transition-all ${
              count === "all"
                ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            全部 / All ({totalQuestions})
          </button>
        </div>
      </section>

      {/* Mode */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          模式 / Mode
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode("original")}
            className={`rounded-lg border px-5 py-3 text-left transition-all ${
              mode === "original"
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="block text-sm font-medium text-gray-900">
              顺序 / Sequential
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              按原始顺序出题
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("random")}
            className={`rounded-lg border px-5 py-3 text-left transition-all ${
              mode === "random"
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="block text-sm font-medium text-gray-900">
              随机 / Random
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              随机打乱顺序
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("mistakes")}
            disabled={mistakesCount === 0}
            className={`rounded-lg border px-5 py-3 text-left transition-all ${
              mode === "mistakes"
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : mistakesCount === 0
                  ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="block text-sm font-medium text-gray-900">
              错题 / Mistakes
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {mistakesCount > 0
                ? `${mistakesCount} 道错题可用`
                : "暂无错题"}
            </span>
          </button>
        </div>
      </section>

      {/* Existing session notice */}
      {hasActiveSession && (
        <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          你有一个未完成的刷题会话。开始新会话将覆盖旧会话。
          <br />
          You have an unfinished quiz session. Starting a new one will replace it.
        </div>
      )}

      {/* Summary + Start */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
        <div>
          <p className="text-sm text-gray-600">
            将出{" "}
            <span className="font-semibold text-gray-900">
              {mode === "mistakes" ? Math.min(effectiveCount, mistakesCount) : effectiveCount}
            </span>{" "}
            题，模式：{" "}
            <span className="font-semibold text-gray-900">
              {mode === "original" ? "顺序" : mode === "random" ? "随机" : "错题"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={starting || mistakesDisabled}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting ? "准备中…" : "开始答题 / Start"}
        </button>
      </div>
    </div>
    </>
  );
}

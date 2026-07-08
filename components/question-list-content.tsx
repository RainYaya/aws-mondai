"use client";

/**
 * components/question-list-content.tsx
 *
 * Client-side paginated list of questions for an exam.
 * Supports search (by question text) and topic filtering.
 * Each row shows the question number, text preview, and topic badges.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Question } from "@/lib/types";
import { blocksToText } from "@/lib/helpers";

const PAGE_SIZE = 20;

interface Props {
  examId: string;
  questions: Question[];
}

export function QuestionListContent({ examId, questions }: Props) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // ── Extract all unique topics ───────────────────────────────────────────
  const allTopics = useMemo(() => {
    const topicSet = new Set<string>();
    for (const q of questions) {
      for (const s of q.content.studyTextSections) {
        if (s.title) topicSet.add(s.title);
      }
    }
    return Array.from(topicSet).sort();
  }, [questions]);

  // ── Filtered questions ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = questions;

    // Topic filter
    if (selectedTopic) {
      result = result.filter((q) =>
        q.content.studyTextSections.some((s) => s.title === selectedTopic),
      );
    }

    // Search filter (by question text, case-insensitive)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((q) => {
        const jaText = blocksToText(q.content.questionBlocks).toLowerCase();
        const zhText = q.translations?.zh.questionText.toLowerCase() ?? "";
        return jaText.includes(query) || zhText.includes(query);
      });
    }

    return result;
  }, [questions, selectedTopic, searchQuery]);

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));

  const pageQuestions = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value);
    setPage(1);
  }

  function handleTopicSelect(topic: string | null) {
    setSelectedTopic(topic);
    setPage(1);
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  const showSearchHint = searchQuery.trim().length > 0 || selectedTopic !== null;
  const showEmpty = filtered.length === 0;
  const hasFilters = searchQuery.trim().length > 0 || selectedTopic !== null;

  return (
    <div>
      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="搜索题目… / Search questions…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Topic filter pills ──────────────────────────────────────────── */}
      {allTopics.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleTopicSelect(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTopic === null
                ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All / 全部
          </button>
          {allTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => handleTopicSelect(topic)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTopic === topic
                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* ── Result count ────────────────────────────────────────────────── */}
      {hasFilters && (
        <p className="mb-3 text-xs text-gray-400">
          {filtered.length} / {questions.length} questions match
        </p>
      )}

      {/* ── Question list ───────────────────────────────────────────────── */}
      {showEmpty ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center text-gray-500">
          <svg className="mb-2 size-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">
            {showSearchHint
              ? "No questions match your search / 没有找到匹配的题目"
              : "No questions found / 暂无题目"}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedTopic(null);
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              Clear filters / 清除筛选
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pageQuestions.map((q, i) => {
            const globalIndex = (safePage - 1) * PAGE_SIZE + i + 1;
            const preview = blocksToText(q.content.questionBlocks).slice(0, 80);
            const topics = q.content.studyTextSections.map((s) => s.title);

            return (
              <Link
                key={q.metadata.questionId}
                href={`/${examId}/${q.metadata.questionId}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500">
                    {globalIndex}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-gray-700">
                      {preview || "(No text content)"}
                    </p>
                    {topics.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {topics.map((t) => (
                          <span
                            key={t}
                            className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <svg
                    className="mt-1 size-4 shrink-0 text-gray-300"
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
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && !showEmpty && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>

          <span className="px-3 text-sm text-gray-500">
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

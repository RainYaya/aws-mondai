"use client";

/**
 * components/question-display.tsx
 *
 * Displays a full question in review (browse) mode:
 * question text, choices with correct answer highlighted,
 * explanation, study materials, and reference URLs — all
 * with bilingual support (Japanese original + Chinese translation).
 */

import { useState } from "react";
import type { LanguagePreference, Question } from "@/lib/types";
import { RichBlockRenderer } from "./rich-block-renderer";

interface Props {
  question: Question;
  lang: LanguagePreference;
}

export function QuestionDisplay({ question, lang }: Props) {
  const [explanationOpen, setExplanationOpen] = useState(true);
  const [studyOpen, setStudyOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);

  const content = question.content;
  const zhTranslation = question.translations?.zh;
  const isMultiple = question.metadata.questionType === "multiple";

  return (
    <article className="space-y-6">
      {/* ── Question text ── */}
      <section>
        <RichBlockRenderer
          jaBlocks={content.questionBlocks}
          zhBlocks={zhTranslation?.questionBlocks}
          lang={lang}
          className="text-base leading-relaxed md:text-lg"
        />
      </section>

      {/* ── Choices ── */}
      <section className="space-y-3">
        {content.choices.map((choice) => {
          const isCorrect = choice.correct;

          const choiceClass = `flex items-start gap-3 rounded-lg border p-4 transition-colors ${
            isCorrect
              ? "border-green-500 bg-green-50"
              : "border-gray-200"
          }`;

          return (
            <div
              key={choice.no}
              className={choiceClass}
            >
              {/* Selection indicator */}
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium border-gray-400 text-gray-600">
                {isMultiple ? (
                  <span className="flex size-3 items-center justify-center rounded-sm border border-green-500 bg-green-500">
                    <svg viewBox="0 0 12 12" className="size-3 text-white">
                      <path
                        d="M3 6l2 2 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="size-2.5 rounded-full bg-green-500" />
                )}
              </span>

              {/* Choice text */}
              <div className="min-w-0 flex-1">
                <RichBlockRenderer
                  jaBlocks={choice.blocks}
                  zhBlocks={zhTranslation?.choices.find((tc) => tc.no === choice.no)?.blocks}
                  lang={lang}
                  inline
                />
              </div>

              {/* Correct indicator */}
              {isCorrect && (
                <span className="shrink-0 text-green-600">
                  <svg
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Correct answer text ── */}
      <section className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">正解 / Correct Answer</p>
        <RichBlockRenderer
          jaBlocks={content.correctAnswerBlocks}
          zhBlocks={zhTranslation?.correctAnswerBlocks}
          lang={lang}
          className="mt-1 text-green-700"
        />
      </section>

      {/* ── Explanation (collapsible) ── */}
      <section className="rounded-lg border border-gray-200">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setExplanationOpen(!explanationOpen)}
        >
          <span>解説 / Explanation</span>
          <svg
            className={`size-4 transition-transform ${explanationOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {explanationOpen && (
          <div className="border-t border-gray-200 px-4 py-3">
            <RichBlockRenderer
              jaBlocks={content.explanationBlocks}
              zhBlocks={zhTranslation?.explanationBlocks}
              lang={lang}
            />
          </div>
        )}
      </section>

      {/* ── Study materials (collapsible) ── */}
      {content.studyTextSections.length > 0 && (
        <section className="rounded-lg border border-gray-200">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setStudyOpen(!studyOpen)}
          >
            <span>参考資料 / Study Materials</span>
            <svg
              className={`size-4 transition-transform ${studyOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {studyOpen && (
            <div className="border-t border-gray-200 px-4 py-3 space-y-4">
              {content.studyTextSections.map((section, i) => (
                <div key={i}>
                  <h4 className="mb-2 font-medium text-gray-800">
                    {lang === "ja" || !zhTranslation?.studyTextSections[i]?.title
                      ? section.title
                      : zhTranslation.studyTextSections[i].title}
                  </h4>
                  <RichBlockRenderer
                    jaBlocks={section.blocks}
                    zhBlocks={zhTranslation?.studyTextSections[i]?.blocks}
                    lang={lang}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Reference URLs (collapsible) ── */}
      {content.referenceUrls.length > 0 && (
        <section className="rounded-lg border border-gray-200">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setRefsOpen(!refsOpen)}
          >
            <span>参考 URL / Reference Links</span>
            <svg
              className={`size-4 transition-transform ${refsOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {refsOpen && (
            <div className="border-t border-gray-200 px-4 py-3 space-y-2">
              {content.referenceUrls.map((ref, i) => (
                <a
                  key={i}
                  href={ref.absoluteUrl || ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 underline hover:text-blue-800"
                >
                  {ref.title || ref.url}
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  );
}

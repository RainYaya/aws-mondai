"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuiz } from '@/lib/quiz-context';
import { useLanguage } from '@/lib/language-context';
import { RichBlockRenderer } from '@/components/rich-block-renderer';
import { blocksToText } from '@/lib/helpers';
import { toggleBookmark, isBookmarked } from '@/lib/storage';

interface Props {
  examId: string;
  examName: string;
}

export function QuizSessionView({ examId, examName }: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const {
    session,
    loading,
    error,
    hydrated,
    currentQuestion,
    currentAnswer,
    progress,
    isComplete,
    submitAnswer,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    finishSession,
  } = useQuiz();
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setMultiSelect([]);
    if (currentQuestion) {
      setBookmarked(isBookmarked(examId, currentQuestion.metadata.questionId));
    }
  }, [session?.currentIndex, examId, currentQuestion]);

  const didFinish = useRef(false);
  useEffect(() => {
    if (isComplete && session && !didFinish.current) {
      didFinish.current = true;
      finishSession();
      router.push('/' + examId + '/quiz/results');
    }
  }, [isComplete, session, examId, router, finishSession]);

  useEffect(() => {
    if (!currentQuestion) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isMultiple = currentQuestion.metadata.questionType === 'multiple';
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const choices = currentQuestion.content.choices;
        if (num <= choices.length) {
          e.preventDefault();
          if (isMultiple) {
            setMultiSelect(p => p.includes(choices[num-1].value) ? p.filter(v => v !== choices[num-1].value) : [...p, choices[num-1].value]);
          } else if (!currentAnswer) {
            submitAnswer([choices[num-1].value]);
          }
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'j') { e.preventDefault(); prevQuestion(); return; }
      if (e.key === 'ArrowRight' || e.key === 'k') { e.preventDefault(); nextQuestion(); return; }
      if (e.key === 'Enter' && isMultiple && multiSelect.length > 0 && !currentAnswer) { e.preventDefault(); submitAnswer(multiSelect); }
      if (e.key === 'b') {
        e.preventDefault();
        const newState = toggleBookmark(examId, currentQuestion.metadata.questionId);
        setBookmarked(newState);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentQuestion, currentAnswer, multiSelect, submitAnswer, prevQuestion, nextQuestion, examId]);

  if (loading || !hydrated) return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-gray-400">Loading session...</p></div>;
  if (error) return <div className="flex min-h-[50vh] flex-col items-center justify-center text-center"><p className="text-lg text-gray-500">Failed to load exam data.</p><p className="mt-1 text-sm text-gray-400">{error}</p><Link href={'/' + examId} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Back to browse</Link></div>;
  if (!session || !currentQuestion) return <div className="flex min-h-[50vh] flex-col items-center justify-center text-center"><p className="text-lg text-gray-500">No active quiz session.</p><p className="mt-1 text-sm text-gray-400">Start a new quiz to begin.</p><Link href={'/' + examId + '/quiz'} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Start a new quiz</Link></div>;

  const q = currentQuestion;
  const isMultiple = q.metadata.questionType === 'multiple';
  const answer = currentAnswer;
  const idx = session.currentIndex;
  const total = session.config.totalCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={'/' + examId + '/quiz'} className="text-sm text-gray-400 hover:text-gray-600">← Quit</Link>
        <span className="text-sm text-gray-500">{progress.correctCount} / {progress.total - progress.unansweredCount} correct</span>
      </div>
      <ProgressBar session={session} currentIndex={idx} onJump={goToQuestion} />
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{idx + 1}</span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{isMultiple ? 'Multiple' : 'Single'}</span>
          <span className="text-xs text-gray-400">{idx + 1} / {total}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              const newState = toggleBookmark(examId, currentQuestion.metadata.questionId);
              setBookmarked(newState);
            }}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
            title={bookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            <svg className="size-3.5" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
        </div>
        <div className="mb-6">
          <RichBlockRenderer jaBlocks={q.content.questionBlocks} zhBlocks={q.translations?.zh.questionBlocks} lang={lang} className="text-base leading-relaxed md:text-lg" />
        </div>
        <div className="space-y-3">
          {q.content.choices.map((choice) => {
            const isSubmitted = answer !== null;
            const isSelected = isMultiple
              ? (answer ? answer.selectedValues.includes(choice.value) : multiSelect.includes(choice.value))
              : answer?.selectedValues[0] === choice.value;
            const isCorrect = choice.correct;
            let border = 'border-gray-200 hover:border-gray-300';
            let bg = 'hover:bg-gray-50';
            let ind: React.ReactNode = null;
            if (isSubmitted) {
              if (isCorrect) { border = 'border-green-500'; bg = 'bg-green-50'; ind = <span className="flex size-6 items-center justify-center rounded-full bg-green-500 text-white"><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>; }
              else if (isSelected) { border = 'border-red-500'; bg = 'bg-red-50'; ind = <span className="flex size-6 items-center justify-center rounded-full bg-red-500 text-white"><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>; }
              else { border = 'border-gray-100'; bg = 'bg-gray-50/50'; }
            }
            return (
              <div key={choice.no} className={'flex items-start gap-3 rounded-lg border p-4 transition-colors ' + border + ' ' + bg + ' ' + (!isSubmitted ? 'cursor-pointer' : '')} onClick={() => { if (isSubmitted) return; if (isMultiple) { setMultiSelect(p => p.includes(choice.value) ? p.filter(v => v !== choice.value) : [...p, choice.value]); } else { submitAnswer([choice.value]); } }}>
                <span className="mt-0.5 flex shrink-0 items-center justify-center">
                  {ind || (isMultiple ? <span className={'flex size-5 items-center justify-center rounded border ' + (multiSelect.includes(choice.value) ? 'border-blue-500 bg-blue-500' : 'border-gray-300')}>{multiSelect.includes(choice.value) && <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}</span> : <span className={'size-5 rounded-full border ' + (answer && answer.selectedValues[0] === choice.value ? (answer.correct ? 'border-green-500 bg-green-500' : 'border-red-500 bg-red-500') : 'border-gray-300')} />)}
                </span>
                <div className="min-w-0 flex-1">
                  <RichBlockRenderer jaBlocks={choice.blocks} zhBlocks={q.translations?.zh.choices.find(tc => tc.no === choice.no)?.blocks} lang={lang} inline />
                </div>
              </div>
            );
          })}
        </div>
        {isMultiple && !answer && (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => { if (multiSelect.length > 0) submitAnswer(multiSelect); }} disabled={multiSelect.length === 0} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Submit Answer</button>
          </div>
        )}
        {answer && (
          <div className="mt-6 space-y-4">
            <div className={'rounded-lg p-4 ' + (answer.correct ? 'bg-green-50 text-green-800 ring-1 ring-green-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200')}>
              <p className="font-semibold">{answer.correct ? 'Correct / 正确' : 'Incorrect / 错误'}</p>
              {!answer.correct && <p className="mt-1 text-sm opacity-80">正解: {q.content.choices.filter(c => c.correct).map(c => blocksToText(c.blocks)).join(', ')}</p>}
            </div>
            <details className="rounded-lg border border-gray-200" open>
              <summary className="cursor-pointer px-4 py-3 font-medium text-gray-700 hover:bg-gray-50">解説 / Explanation</summary>
              <div className="border-t border-gray-200 px-4 py-3"><RichBlockRenderer jaBlocks={q.content.explanationBlocks} zhBlocks={q.translations?.zh.explanationBlocks} lang={lang} /></div>
            </details>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevQuestion} disabled={idx === 0} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg><span className="hidden sm:inline">Prev</span><span className="sm:hidden">←</span></button>
        <div className="flex flex-col items-center gap-1">
          {isComplete && <Link href={'/' + examId + '/quiz/results'} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-green-700 sm:px-5 sm:text-sm">View Results / 查看结果</Link>}
          <span className="text-[10px] text-gray-400">? 键查看快捷键 / Press ? for shortcuts</span>
        </div>
        <button type="button" onClick={nextQuestion} disabled={idx === total - 1} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"><span className="hidden sm:inline">Next</span><span className="sm:hidden">→</span><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></button>
      </div>
    </div>
  );
}

function ProgressBar({ session, currentIndex, onJump }: { session: import('@/lib/quiz-engine').QuizSession; currentIndex: number; onJump: (i: number) => void }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1.5" style={{ minWidth: session.config.questionIds.length > 30 ? 'max-content' : undefined }}>
        {session.config.questionIds.map((qid, i) => {
          const a = session.answers[qid];
          let cls = 'size-7 shrink-0 rounded-lg text-xs font-medium transition-all border cursor-pointer flex items-center justify-center';
          if (i === currentIndex) cls += ' ring-2 ring-blue-400 ring-offset-1';
          if (a) { cls += a.correct ? ' border-green-500 bg-green-100 text-green-700' : ' border-red-500 bg-red-100 text-red-700'; }
          else { cls += ' border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'; }
          return <button key={qid} type="button" className={cls} onClick={() => onJump(i)} title={'#' + (i + 1)}>{i + 1}</button>;
        })}
      </div>
    </div>
  );
}
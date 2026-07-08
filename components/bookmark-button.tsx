"use client";

import { useState, useEffect } from "react";
import { isBookmarked, toggleBookmark } from "@/lib/storage";

interface Props {
  examId: string;
  questionId: string;
}

export function BookmarkButton({ examId, questionId }: Props) {
  const [bookmarked, setBookmarked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(examId, questionId));
    setHydrated(true);
  }, [examId, questionId]);

  function handleToggle() {
    const newState = toggleBookmark(examId, questionId);
    setBookmarked(newState);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!hydrated}
      className={"inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors " +
        (bookmarked
          ? "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
          : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50")}
      title={bookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <svg className="size-4" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
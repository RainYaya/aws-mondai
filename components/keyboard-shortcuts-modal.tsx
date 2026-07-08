"use client";

/**
 * components/keyboard-shortcuts-modal.tsx
 *
 * Modal displaying all available keyboard shortcuts.
 * Triggered by pressing `?` anywhere in the app.
 */

import { useEffect, useState, useCallback } from "react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; desc: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "通用 / General",
    shortcuts: [
      { keys: "← / →", desc: "上一题 / 下一题 Previous / Next question" },
      { keys: "j / k", desc: "上一题 / 下一题 (vim 风格) Previous / Next (vim)" },
      { keys: "b", desc: "收藏 / 取消收藏 Toggle bookmark" },
      { keys: "?", desc: "显示此帮助 Show this help" },
    ],
  },
  {
    title: "答题模式 / Quiz Mode",
    shortcuts: [
      { keys: "1 – 4", desc: "选择选项 Select option (1-9)" },
      { keys: "Enter", desc: "提交多选答案 Submit multiple-choice answer" },
    ],
  },
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "?" && !e.shiftKey) return; // Shift+? = actual ? key
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === "Escape" && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            快捷键 / Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center gap-3">
                    <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700 shadow-sm">
                      {s.keys}
                    </kbd>
                    <span className="text-sm text-gray-600">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          Press <kbd className="rounded border border-gray-200 bg-gray-50 px-1 font-mono text-xs text-gray-600">?</kbd> to close
        </p>
      </div>
    </div>
  );
}

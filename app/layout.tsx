/**
 * app/layout.tsx
 *
 * Root layout — wraps all pages with LanguageProvider, NavBar, and footer.
 */

import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/language-context";
import { NavBar } from "@/components/nav-bar";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWS Mondai — 双语刷题",
  description:
    "AWS 认证考试双语刷题网站。以中文为主导、日文为辅助，支持浏览学习和模拟答题。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // lang="ja" because the authoritative source content is Japanese;
  // the Chinese translation is an AI-generated overlay.
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col">
        <LanguageProvider>
          <NavBar />
          <KeyboardShortcutsModal />
            <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
              {children}
            </main>
          {/* Translation disclaimer at page bottom — PRD: "页面底部显示" */}
          <footer className="border-t border-gray-100 bg-amber-50/80 px-4 py-3 text-center text-xs text-amber-700">
            中文翻译由 AI 生成，仅供参考 / AI-generated Chinese translation for reference only
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}

"use client";

/**
 * components/rich-block-renderer.tsx
 *
 * Renders a RichBlock[] array into appropriate DOM elements.
 * - text  → <span>
 * - image → <img> with error fallback (grey placeholder + alt)
 * - linebreak → <br>
 * - link  → <a>
 *
 * Supports bilingual mode: when `lang` is "bilingual", Japanese and Chinese
 * blocks are stacked vertically (Chinese above, Japanese below).
 */

import { useState, type CSSProperties } from "react";
import type { LanguagePreference, RichBlock } from "@/lib/types";

interface Props {
  /** Primary language blocks (Japanese — from content.*) — may be undefined */
  jaBlocks?: RichBlock[];
  /** Translation blocks (Chinese — from translations.zh.*) — may be empty */
  zhBlocks?: RichBlock[];
  /** Current language mode */
  lang: LanguagePreference;
  /** Additional class names */
  className?: string;
  /** Override the default rendering wrapper style */
  style?: CSSProperties;
  /** Whether this is within a choice label (inline friendly) */
  inline?: boolean;
}

export function RichBlockRenderer({
  jaBlocks,
  zhBlocks,
  lang,
  className = "",
  style,
  inline = false,
}: Props) {
  const effectiveZh = zhBlocks && zhBlocks.length > 0 ? zhBlocks : undefined;

  const safeJa = jaBlocks ?? [];
  const safeZh = effectiveZh ?? [];

  if (lang === "ja" || !effectiveZh) {
    // Japanese-only or no translation available
    const Wrapper = inline ? "span" : "div";
    return (
      <Wrapper className={className} style={style}>
        {safeJa.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </Wrapper>
    );
  }

  if (lang === "zh") {
    // Chinese-only
    const Wrapper = inline ? "span" : "div";
    return (
      <Wrapper className={className} style={style}>
        {safeZh.length > 0
          ? safeZh.map((block, i) => <BlockRenderer key={i} block={block} />)
          : safeJa.map((block, i) => <BlockRenderer key={i} block={block} />)}
      </Wrapper>
    );
  }

  // Bilingual: Chinese (large, dark) above, Japanese (small, gray) below
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={className} style={style}>
      <div className="text-base leading-relaxed text-gray-900 [&_img]:my-2">
        {effectiveZh.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
      <div className="mt-1 text-sm leading-relaxed text-gray-500 [&_img]:my-2">
        {safeJa.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </Wrapper>
  );
}

// ─── Single block renderer ──────────────────────────────────────────────────

function BlockRenderer({ block }: { block: RichBlock }) {
  switch (block.type) {
    case "text":
      return <span>{block.text}</span>;

    case "linebreak":
      return <br />;

    case "image":
      return <ImageBlock block={block} />;

    case "link":
      return (
        <a
          href={block.href || block.absoluteHref || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          {block.text || block.href}
        </a>
      );

    default:
      return null;
  }
}

// ─── Image with error fallback ──────────────────────────────────────────────

function ImageBlock({ block }: { block: RichBlock }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        className="inline-flex items-center justify-center rounded border border-gray-200 bg-gray-100 px-3 py-6 text-sm text-gray-400"
        role="img"
        aria-label={block.alt || "Image"}
      >
        {block.alt || "Image"}
      </span>
    );
  }

  return (
    <img
      src={block.absoluteSrc || block.src}
      alt={block.alt || ""}
      className="max-w-full rounded"
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}


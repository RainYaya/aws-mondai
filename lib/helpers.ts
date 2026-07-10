/**
 * lib/helpers.ts
 *
 * Pure utility functions for the AWS Mondai frontend.
 * No React dependency — safe to import from server components.
 */

import type { RichBlock } from "./types";

/**
 * Extract plain text from a RichBlock[] array, collapsing whitespace.
 * Useful for search previews, prev/next labels, etc.
 */
export function blocksToText(blocks: RichBlock[] | undefined | null): string {
  if (!blocks) return "";
  return blocks
    .map((b) => (b.type === "text" ? b.text || "" : b.type === "linebreak" ? " " : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * scripts/copy-data.ts
 *
 * Copies data/processed/*.json to public/data/ so Next.js can serve them
 * as static files at runtime (for quiz mode) while SSG pages read directly
 * from data/processed/ at build time.
 *
 * Usage:   tsx scripts/copy-data.ts
 * Running: npm run copy-data (configured in package.json)
 */

import fs from "node:fs/promises";
import path from "node:path";

const SRC = path.join(process.cwd(), "data", "processed");
const DEST = path.join(process.cwd(), "public", "data");

async function copyData(): Promise<void> {
  await fs.mkdir(DEST, { recursive: true });

  const entries = await fs.readdir(SRC, { withFileTypes: true });
  const jsonFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith(".json"),
  );

  for (const file of jsonFiles) {
    await fs.copyFile(path.join(SRC, file.name), path.join(DEST, file.name));
    console.log(`[copy-data] Copied ${file.name}`);
  }

  console.log(`[copy-data] Done — ${jsonFiles.length} file(s) copied.`);
}

copyData().catch((err) => {
  console.error("[copy-data] Error:", err);
  process.exit(1);
});

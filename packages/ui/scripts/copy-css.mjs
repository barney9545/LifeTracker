// Copies the hand-authored, self-contained styles.css into dist/ so the
// published package ships tokens + component classes with zero build step.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "src", "styles.css");
const outDir = join(root, "dist");
const dest = join(outDir, "styles.css");

mkdirSync(outDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-css] ${src} -> ${dest}`);

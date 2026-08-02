import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import tailwindPlugin from "./plugins/tailwind-plugin";
import solidPlugin from "./plugins/solid-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, ".");
const distDir = path.join(ROOT, "dist");

async function build() {
  try {
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true, force: true });
    }
    mkdirSync(distDir, { recursive: true });

    console.log("Building call-me-bob...");
    const result = await Bun.build({
      entrypoints: [path.join(ROOT, "index.html")],
      outdir: distDir,
      target: "browser",
      plugins: [tailwindPlugin, solidPlugin],
    });

    if (!result.success) {
      console.error("Build failed:");
      for (const log of result.logs) {
        console.error(log);
      }
      process.exit(1);
    }

    // GitHub Pages has no SPA fallback: clone the built site into
    // dist/<exercise-id>/ so each chore URL (e.g. /call-me-bob-05/chore-wheel)
    // serves a real page and survives F5. The app reads the slug from the URL.
    const { EXERCISES } = await import(path.join(ROOT, "src", "exercises.js"));
    const files = readdirSync(distDir).filter((f) =>
      statSync(path.join(distDir, f)).isFile(),
    );
    for (const ex of EXERCISES) {
      const dir = path.join(distDir, ex.id);
      mkdirSync(dir, { recursive: true });
      for (const f of files) cpSync(path.join(distDir, f), path.join(dir, f));
    }
    console.log(`Cloned site into ${EXERCISES.length} chore routes.`);

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();

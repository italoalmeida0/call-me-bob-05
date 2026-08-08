import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import tailwindPlugin from "./plugins/tailwind-plugin";
import solidPlugin from "./plugins/solid-plugin";
import workerInlinePlugin from "./plugins/worker-inline-plugin";

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
      plugins: [tailwindPlugin, solidPlugin, workerInlinePlugin],
      define: {
        // Short-url API used by the Share button (build-time env)
        "process.env.SHORT_URL_API": JSON.stringify(
          process.env.SHORT_URL_API || "https://url.hezz.it",
        ),
      },
    });

    if (!result.success) {
      console.error("Build failed:");
      for (const log of result.logs) {
        console.error(log);
      }
      process.exit(1);
    }

    // Copy the local Pyodide runtime (core + wheels + lockfile) into
    // dist/pyodide/. The Web Worker loads these files at runtime instead
    // of hitting a CDN. build.ts runs from the repo root, so src is
    // ROOT/pyodide.
    cpSync(path.join(ROOT, "pyodide"), path.join(distDir, "pyodide"), {
      recursive: true,
    });
    console.log("Copied local Pyodide runtime into dist/pyodide/");

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
      // The worker loads pyodide/ relative to its own URL, so every
      // exercise route needs its own copy of the runtime too.
      cpSync(path.join(distDir, "pyodide"), path.join(dir, "pyodide"), {
        recursive: true,
      });
    }
    console.log(`Cloned site into ${EXERCISES.length} chore routes.`);

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();

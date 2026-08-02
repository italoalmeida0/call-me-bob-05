import { existsSync, mkdirSync, rmSync } from "fs";
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

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();

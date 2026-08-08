import type { BunPlugin } from "bun";

const PLUGIN_NAME = "worker-inline";

// Inlines a *.worker.js import as a text string so grader.js can spin
// up the worker from a Blob URL. Blob workers work identically in dev
// and prod and don't need the bundler to emit a separate chunk.
export default {
  name: PLUGIN_NAME,
  setup(build) {
    build.onLoad({ filter: /\.worker\.js$/ }, async (args) => {
      const content = await Bun.file(args.path).text();
      return {
        contents: `export default ${JSON.stringify(content)};`,
        loader: "js",
      };
    });
  },
} as BunPlugin;

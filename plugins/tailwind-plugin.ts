import fs from 'fs';

import tailwindcss from '@tailwindcss/postcss';
import type { BunPlugin } from 'bun';
import postcss from 'postcss';
const PLUGIN_NAME = 'tailwind-compiler';

export default {
  name: PLUGIN_NAME,

  setup(build) {
    build.onLoad({ filter: /\.tailwindcss\.css$/ }, async (args) => {
      try {
        const inputPath = args.path;

        const css = fs.readFileSync(inputPath, 'utf-8');

        const result = await postcss([tailwindcss]).process(css, {
          from: inputPath,
          to: inputPath.replace('.tailwindcss.css', '.css'),
        });

        return {
          contents: result.css,
          loader: 'css',
        };
      } catch (err) {
        console.error(`[${PLUGIN_NAME}] ✗ Error compiling ${args.path}:`, (err as Error).message);
        return {
          contents: `/* Error compiling Tailwind: ${(err as Error).message} */`,
          loader: 'css',
        };
      }
    });
  },
} as BunPlugin;

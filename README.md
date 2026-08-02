# call-me-bob 🤖 05

**To-Do List #05** — Bob has a to-do list. You have Python. Let's make a deal.

A cozy, game-like site to practice Python in the browser. Help Bob tally his
crates, book the village barns, plant a spiral garden, read grandma's quilt,
repaint the signposts and untangle his chore wheel — one chore at a time. No
timers, no pressure: pick a chore, read Bob's note, write your function and
hit **Grade me!**. Bob's little robot helper checks your code right in your
browser and shows a full test trace.

## Features

- 📝 **6 chores** across 4 days of Bob's week, each with a story-driven subject
- 🐍 **Python editor** powered by CodeMirror 6 (syntax highlighting, indent guides)
- 🤖 **In-browser grading** — tests run locally via [Pyodide](https://pyodide.org)
  (WebAssembly CPython), nothing ever leaves your machine
- 🔍 **Full test trace** — every test case shows the call, expected value, your
  result and OK/KO, just like a terminal grader
- ⭐ **Progress tracking** — solved chores and your code are saved in
  `localStorage`
- 📱 **Responsive** — works on desktop and mobile

## Tech stack

- [Bun](https://bun.sh) — dev server & bundler
- [SolidJS](https://www.solidjs.com) — UI
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [CodeMirror 6](https://codemirror.net) — editor
- [Pyodide](https://pyodide.org) — Python runtime for grading

## Development

```bash
bun install
bun run dev      # http://localhost:5800
```

## Build & deploy

```bash
bun run build    # outputs the static site to ./dist
bun run start    # preview the build on http://localhost:5980
```

The `dist/` folder is fully static — deploy it to GitHub Pages, Netlify,
Cloudflare Pages or any static host as-is.

## License

[MIT](./LICENSE) © Italo Almeida

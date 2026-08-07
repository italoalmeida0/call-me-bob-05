# call-me-bob 🤖 05

**To-Do List #05** — Bob has a to-do list. You have Python. Let's make a deal.

A cozy, game-like site to practice Python in the browser. Help Bob book the
village barns, line up delivery crates, untangle his chore wheel, tally the
crate ledger, plant a spiral garden, read grandma's quilt and repaint the
signposts — one chore at a time. No timers, no pressure: pick a chore, read
Bob's note, write your function and hit **Grade me!**. Bob's little robot
helper checks your code right in your browser and shows a full test trace.

**🌐 Live site:** https://italoalmeida0.github.io/call-me-bob-05/

**🧭 Bob's other to-do lists:** ⬅️ [call-me-bob 04](https://github.com/italoalmeida0/call-me-bob-04)

## The chores

Every chore card shows **topic chips** — the classic computer-science
concepts behind the puzzle, so you know exactly what to study before (or
after) solving it.

| Day | Chore | What Bob needs | Topics to study |
|-----|-------|----------------|-----------------|
| 1 | Barn Bookings | Minimum rooms for overlapping intervals, with the exact first-fit assignment | Meeting Rooms, Greedy / Intervals |
| 1 | The Crate Rows | Split a list into rows of n, padding the short last row with `None` | List Chunking, Matrix Building |
| 2 | The Chore Wheel | Detect a directed cycle in a chore graph — **without** `graphlib` (`TopologicalSorter`, `CycleError`) | Graph Cycle Detection, DFS |
| 2 | The Crate Ledger | Run-length encode a tally and decode it back — counts never exceed 9, two functions | Run-Length Encoding, String Parsing |
| 3 | The Coil Garden | Fill an n×n matrix with 1..n² in a clockwise spiral | Spiral Matrix, Matrix Simulation |
| 3 | Grandma's Quilt | Find a word in a letter grid across 8 directions, reporting position and direction | Word Search, 2D Grid Traversal |
| 3 | Signpost Repaint | Shortest word chain changing one letter at a time through a dictionary | Word Ladder, BFS |

## How it works

- 📝 **7 chores** across 3 days of Bob's week, each with a story-driven subject
- 🐍 **Python editor** powered by CodeMirror 6 (syntax highlighting, indent guides,
  4-space indent matching [Black](https://github.com/psf/black))
- 🤖 **In-browser grading** — tests run locally via [Pyodide](https://pyodide.org)
  (WebAssembly CPython), nothing ever leaves your machine
- 🔍 **Full test trace** — every test case shows `[OK]`/`[KO]` up front, then the
  call, the expected value and your result on aligned lines with horizontal
  scroll — just like a terminal grader
- ▶️ **Run button** — run your script anytime and see `print()` output in the
  robot log, with a 15s infinite-loop guard
- 🚫 **Enforced rules** — chores that ban a function or module (`graphlib` in
  The Chore Wheel) check your code statically AND at runtime, no sneaky
  workarounds
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
Cloudflare Pages or any static host as-is. This repo deploys automatically
to GitHub Pages on every push to `main` via GitHub Actions.

## License

[MIT](./LICENSE) © Italo Almeida

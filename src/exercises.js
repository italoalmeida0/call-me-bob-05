/**
 * exercises.js — Bob's chore list.
 *
 * Each chore has:
 *   id        unique slug (used for localStorage)
 *   tier      1..3 (Bob's week: growing difficulty, one boss chore on Day 3)
 *   title     story title
 *   tagline   one-line teaser for the card
 *   icon      material-symbols icon name
 *   topics    study-topic chips shown under the title
 *   funcName  the main function the player must implement
 *   stub      starter code shown in the editor
 *   story     array of paragraphs (the subject, Bob-flavored)
 *   signature the required def line(s)
 *   rules     array of bullet rules
 *   examples  [{ input, output, note? }] — shown in the subject
 *   tests     [{ call, args, expected, func? }] — args/expected are PYTHON
 *             literals evaluated inside the Pyodide grader; `call` is
 *             display-only. `func` overrides funcName for that test
 *             (used by chores with more than one function).
 */

export const TIERS = [
  { tier: 1, label: "Day 1", subtitle: "Dock & Garden" },
  { tier: 2, label: "Day 2", subtitle: "Around the Village" },
  { tier: 3, label: "Day 3", subtitle: "Loose Ends" },
];

export const EXERCISES = [
  // -----------------------------------------------------------------------
  // DAY 1
  // -----------------------------------------------------------------------
  {
    id: "crate-ledger",
    tier: 1,
    title: "The Crate Ledger",
    tagline: "Bob tallies crates on the dock with a lazy shorthand.",
    icon: "inventory-2",
    funcName: "pack_tally",
    topics: ["Run-Length Encoding", "String Parsing"],
    stub: "def pack_tally(tally: str) -> str:\n    pass\n\n\ndef unpack_tally(packed: str) -> str:\n    pass\n",
    story: [
      "Bob spends his mornings at the dock, counting delivery crates. Each crate is stamped with a letter, and the crates come off the boat in long runs of the same stamp: 'mmmaa', 'tttt', and so on.",
      "Writing every letter by hand is killing him, so Bob invented a shorthand: a run of identical letters becomes the letter followed by how many times it repeats — but if the letter shows up only once, he skips the number (laziness above all). So 'mmmaa' turns into 'm3a2', and 'abc' stays 'abc'.",
      "Now Bob needs two functions: one that packs his longhand tally into shorthand, and one that unpacks a shorthand string back into the full tally (the number after a letter can have several digits — a really big boat showed up once).",
    ],
    signature: "def pack_tally(tally: str) -> str:\ndef unpack_tally(packed: str) -> str:",
    rules: [
      "pack_tally replaces each run of identical letters with the letter plus the run length",
      "The count is written only when the run has 2 or more letters",
      "unpack_tally reads a letter followed by an optional number and repeats the letter that many times",
      "A letter with no number after it unpacks to a single letter",
      "Counts can be multi-digit ('m12' unpacks to twelve m's)",
      "Tally strings given to pack_tally contain letters only, no digits",
      "An empty string packs to an empty string, and vice versa",
      "Letter case matters ('A' and 'a' are different stamps)",
    ],
    examples: [
      { input: 'pack_tally("aabccca")', output: '"a2bc3a"' },
      { input: 'pack_tally("abc")', output: '"abc"', note: "no runs longer than 1" },
      { input: 'pack_tally("aaaaaaaaaa")', output: '"a10"', note: "ten a's — multi-digit count" },
      { input: 'pack_tally("")', output: '""' },
      { input: 'unpack_tally("a2bc3a")', output: '"aabccca"' },
      { input: 'unpack_tally("a10b")', output: '"aaaaaaaaaab"' },
      { input: 'unpack_tally("abc")', output: '"abc"' },
    ],
    tests: [
      { call: 'pack_tally("aabccca")', args: '("aabccca",)', expected: '"a2bc3a"' },
      { call: 'pack_tally("abc")', args: '("abc",)', expected: '"abc"' },
      { call: 'pack_tally("")', args: '("",)', expected: '""' },
      { call: 'pack_tally("aaaaaaaaaa")', args: '("aaaaaaaaaa",)', expected: '"a10"' },
      { call: 'pack_tally("a")', args: '("a",)', expected: '"a"' },
      { call: 'pack_tally("zzzzyyyyyx")', args: '("zzzzyyyyyx",)', expected: '"z4y5x"' },
      { call: 'pack_tally("aaabaaa")', args: '("aaabaaa",)', expected: '"a3ba3"' },
      { call: 'pack_tally("abbbbbc")', args: '("abbbbbc",)', expected: '"ab5c"' },
      { call: 'pack_tally("mmmmmmmmmmmm")', args: '("mmmmmmmmmmmm",)', expected: '"m12"' },
      { call: 'pack_tally("ababab")', args: '("ababab",)', expected: '"ababab"' },
      { call: 'pack_tally("AaA")', args: '("AaA",)', expected: '"AaA"' },
      { call: 'pack_tally("aabb")', args: '("aabb",)', expected: '"a2b2"' },
      { call: 'pack_tally("aaabbc")', args: '("aaabbc",)', expected: '"a3b2c"' },
      { call: 'pack_tally("aaaa")', args: '("aaaa",)', expected: '"a4"' },
      { call: 'unpack_tally("a2bc3a")', args: '("a2bc3a",)', expected: '"aabccca"', func: "unpack_tally" },
      { call: 'unpack_tally("abc")', args: '("abc",)', expected: '"abc"', func: "unpack_tally" },
      { call: 'unpack_tally("")', args: '("",)', expected: '""', func: "unpack_tally" },
      { call: 'unpack_tally("a10b")', args: '("a10b",)', expected: '"aaaaaaaaaab"', func: "unpack_tally" },
      { call: 'unpack_tally("z4y5x")', args: '("z4y5x",)', expected: '"zzzzyyyyyx"', func: "unpack_tally" },
      { call: 'unpack_tally("m12")', args: '("m12",)', expected: '"mmmmmmmmmmmm"', func: "unpack_tally" },
      { call: 'unpack_tally("a1b1")', args: '("a1b1",)', expected: '"ab"', func: "unpack_tally" },
      { call: 'unpack_tally("x2y")', args: '("x2y",)', expected: '"xxy"', func: "unpack_tally" },
      { call: 'unpack_tally("a3ba3")', args: '("a3ba3",)', expected: '"aaabaaa"', func: "unpack_tally" },
      { call: 'unpack_tally("q9")', args: '("q9",)', expected: '"qqqqqqqqq"', func: "unpack_tally" },
      { call: 'unpack_tally("a3b2c")', args: '("a3b2c",)', expected: '"aaabbc"', func: "unpack_tally" },
      { call: 'unpack_tally("a4")', args: '("a4",)', expected: '"aaaa"', func: "unpack_tally" },
    ],
  },
  {
    id: "coil-garden",
    tier: 1,
    title: "The Coil Garden",
    tagline: "Bob plants his seedlings in a spiral. Don't ask why.",
    icon: "cyclone",
    funcName: "spiral_beds",
    topics: ["Spiral Matrix", "Matrix Simulation"],
    stub: "def spiral_beds(n: int) -> list[list[int]]:\n    pass\n",
    story: [
      "Bob read in a gardening magazine that plants grow happier in a spiral. So he divided his square garden into n by n beds and started numbering them with a stick in the mud: bed 1 in the top-left corner, then walking right until the edge, down, left, up... coiling tighter and tighter until every bed has a number.",
      "Given the garden size n, return the map of bed numbers as a list of rows (each row a list of integers), so Bob can check his work from the porch.",
    ],
    signature: "def spiral_beds(n: int) -> list[list[int]]:",
    rules: [
      "Return an n x n matrix filled with numbers 1 to n*n",
      "Start at the top-left corner and spiral clockwise: right, down, left, up, repeat",
      "The matrix is a list of n rows, each row a list of n integers",
      "If n is 0 or negative, there is no garden — return an empty list",
    ],
    examples: [
      {
        input: "spiral_beds(3)",
        output: "[[1, 2, 3], [8, 9, 4], [7, 6, 5]]",
        note: "1 in the corner, coiling clockwise",
      },
      {
        input: "spiral_beds(2)",
        output: "[[1, 2], [4, 3]]",
      },
      {
        input: "spiral_beds(1)",
        output: "[[1]]",
      },
      {
        input: "spiral_beds(0)",
        output: "[]",
        note: "no garden",
      },
    ],
    tests: [
      { call: "spiral_beds(0)", args: "(0,)", expected: "[]" },
      { call: "spiral_beds(1)", args: "(1,)", expected: "[[1]]" },
      { call: "spiral_beds(2)", args: "(2,)", expected: "[[1, 2], [4, 3]]" },
      { call: "spiral_beds(3)", args: "(3,)", expected: "[[1, 2, 3], [8, 9, 4], [7, 6, 5]]" },
      { call: "spiral_beds(4)", args: "(4,)", expected: "[[1, 2, 3, 4], [12, 13, 14, 5], [11, 16, 15, 6], [10, 9, 8, 7]]" },
      { call: "spiral_beds(5)", args: "(5,)", expected: "[[1, 2, 3, 4, 5], [16, 17, 18, 19, 6], [15, 24, 25, 20, 7], [14, 23, 22, 21, 8], [13, 12, 11, 10, 9]]" },
      { call: "spiral_beds(6)", args: "(6,)", expected: "[[1, 2, 3, 4, 5, 6], [20, 21, 22, 23, 24, 7], [19, 32, 33, 34, 25, 8], [18, 31, 36, 35, 26, 9], [17, 30, 29, 28, 27, 10], [16, 15, 14, 13, 12, 11]]" },
      { call: "spiral_beds(-3)", args: "(-3,)", expected: "[]" },
      { call: "spiral_beds(7)", args: "(7,)", expected: "[[1, 2, 3, 4, 5, 6, 7], [24, 25, 26, 27, 28, 29, 8], [23, 40, 41, 42, 43, 30, 9], [22, 39, 48, 49, 44, 31, 10], [21, 38, 47, 46, 45, 32, 11], [20, 37, 36, 35, 34, 33, 12], [19, 18, 17, 16, 15, 14, 13]]" },
    ],
  },

  // -----------------------------------------------------------------------
  // DAY 2
  // -----------------------------------------------------------------------
  {
    id: "barn-bookings",
    tier: 2,
    title: "Barn Bookings",
    tagline: "How many barns does Bob need for the village workshops?",
    icon: "warehouse",
    funcName: "plan_barn_days",
    topics: ["Meeting Rooms", "Greedy / Intervals"],
    stub: "def plan_barn_days(bookings: list[tuple[int, int]]) -> tuple[int, list]:\n    pass\n",
    story: [
      "The village fair is coming and every club wants to run a workshop in Bob's barns. Each request is a (start, end) time slot. Two workshops can't share a barn at the same time, but back-to-back is fine — if one ends at 5, the next can start at 5.",
      "Bob handles the requests in ascending start time (if two start together, he keeps the order they arrived). For each request he uses the FIRST barn — in the order the barns were opened — whose last workshop ends at or before the new start. If no barn is free, he sighs and opens another one.",
      "Return how many barns Bob ended up using, along with the final schedule of each barn.",
    ],
    signature: "def plan_barn_days(bookings: list[tuple[int, int]]) -> tuple[int, list]:",
    rules: [
      "Process bookings sorted by start time; equal starts keep their original order",
      "Assign each booking to the first barn (in opening order) whose last booking ends at or before the new start",
      "If no barn fits, open a new one",
      "Back-to-back bookings in the same barn are allowed (end <= start)",
      "Return a tuple: (number of barns, list of barn schedules)",
      "Each barn schedule is the list of its bookings as (start, end) tuples, in the order they were booked",
      "No bookings at all means (0, [])",
    ],
    examples: [
      {
        input: "plan_barn_days([(1, 4), (2, 5), (6, 8)])",
        output: "(2, [[(1, 4), (6, 8)], [(2, 5)]])",
        note: "barn 1 hosts 1-4 and 6-8, barn 2 hosts 2-5",
      },
      {
        input: "plan_barn_days([(1, 3), (3, 5), (5, 7)])",
        output: "(1, [[(1, 3), (3, 5), (5, 7)]])",
        note: "back-to-back fits in a single barn",
      },
      {
        input: "plan_barn_days([(9, 10), (4, 9), (3, 8)])",
        output: "(2, [[(3, 8), (9, 10)], [(4, 9)]])",
        note: "requests are handled in ascending start time",
      },
      {
        input: "plan_barn_days([])",
        output: "(0, [])",
        note: "no requests, no barns",
      },
    ],
    tests: [
      { call: "plan_barn_days([])", args: "([],)", expected: "(0, [])" },
      { call: "plan_barn_days([(1, 4), (2, 5), (6, 8)])", args: "([(1, 4), (2, 5), (6, 8)],)", expected: "(2, [[(1, 4), (6, 8)], [(2, 5)]])" },
      { call: "plan_barn_days([(1, 3), (3, 5), (5, 7)])", args: "([(1, 3), (3, 5), (5, 7)],)", expected: "(1, [[(1, 3), (3, 5), (5, 7)]])" },
      { call: "plan_barn_days([(9, 10), (4, 9), (3, 8)])", args: "([(9, 10), (4, 9), (3, 8)],)", expected: "(2, [[(3, 8), (9, 10)], [(4, 9)]])" },
      { call: "plan_barn_days([(1, 10), (2, 9), (3, 8), (4, 7)])", args: "([(1, 10), (2, 9), (3, 8), (4, 7)],)", expected: "(4, [[(1, 10)], [(2, 9)], [(3, 8)], [(4, 7)]])" },
      { call: "plan_barn_days([(5, 8), (1, 3), (3, 5)])", args: "([(5, 8), (1, 3), (3, 5)],)", expected: "(1, [[(1, 3), (3, 5), (5, 8)]])" },
      { call: "plan_barn_days([(0, 30), (5, 10), (15, 20)])", args: "([(0, 30), (5, 10), (15, 20)],)", expected: "(2, [[(0, 30)], [(5, 10), (15, 20)]])" },
      { call: "plan_barn_days([(1, 5), (1, 3)])", args: "([(1, 5), (1, 3)],)", expected: "(2, [[(1, 5)], [(1, 3)]])" },
      { call: "plan_barn_days([(1, 4), (1, 4), (1, 4)])", args: "([(1, 4), (1, 4), (1, 4)],)", expected: "(3, [[(1, 4)], [(1, 4)], [(1, 4)]])" },
      { call: "plan_barn_days([(1, 3), (2, 4), (3, 5), (4, 6)])", args: "([(1, 3), (2, 4), (3, 5), (4, 6)],)", expected: "(2, [[(1, 3), (3, 5)], [(2, 4), (4, 6)]])" },
      { call: "plan_barn_days([(-5, -1), (-3, 2)])", args: "([(-5, -1), (-3, 2)],)", expected: "(2, [[(-5, -1)], [(-3, 2)]])" },
      { call: "plan_barn_days([(2, 2), (2, 3)])", args: "([(2, 2), (2, 3)],)", expected: "(1, [[(2, 2), (2, 3)]])" },
      { call: "plan_barn_days([(7, 9)])", args: "([(7, 9)],)", expected: "(1, [[(7, 9)]])" },
      { call: "plan_barn_days([(1, 2), (2, 3), (1, 2), (2, 3)])", args: "([(1, 2), (2, 3), (1, 2), (2, 3)],)", expected: "(2, [[(1, 2), (2, 3)], [(1, 2), (2, 3)]])" },
    ],
  },
  {
    id: "quilt-motto",
    tier: 2,
    title: "Grandma's Quilt",
    tagline: "Find where grandma stitched her motto into the quilt.",
    icon: "texture",
    funcName: "find_motto",
    topics: ["Word Search", "2D Grid Traversal"],
    stub: "def find_motto(quilt: list[str], motto: str) -> list[tuple[int, int, str]]:\n    pass\n",
    story: [
      "Grandma Bob stitched a quilt made of little lettered squares — a grid of characters. Family legend says she hid her favorite motto in it, embroidered in a straight line: across, down, or along one of the diagonals, in either direction.",
      "Given the quilt (a list of equal-length strings, one per row) and the motto, return every place it appears. A match is reported as (x, y, code): x is the column and y is the row of the motto's FIRST letter, with (0, 0) at the top-left corner, and code tells which way it reads from there.",
      "The direction codes are: 'H' left-to-right, 'H-' right-to-left, 'V' top-to-bottom, 'V-' bottom-to-top, 'D1' down-right diagonal, 'D1-' up-left diagonal, 'D2' down-left diagonal, 'D2-' up-right diagonal.",
    ],
    signature: "def find_motto(quilt: list[str], motto: str) -> list[tuple[int, int, str]]:",
    rules: [
      "Scan the quilt column by column (x from 0 to width-1), and inside each column row by row (y from 0 to height-1)",
      "At each square, try the directions in this order: H, H-, V, V-, D1, D1-, D2, D2-",
      "Collect every match as a tuple (x, y, code) — matches may overlap",
      "Coordinates are (column, row), with (0, 0) at the top-left",
      "A match that would fall off the quilt's edges doesn't count",
      "A one-letter motto matches in ALL 8 directions from its square",
      "An empty quilt or an empty motto means no matches (return [])",
      "Letter case matters",
    ],
    examples: [
      {
        input: 'find_motto(["abc", "def", "ghi"], "aei")',
        output: "[(0, 0, 'D1')]",
        note: "a, e, i run down-right from the corner",
      },
      {
        input: 'find_motto(["abc", "def", "ghi"], "cfi")',
        output: "[(2, 0, 'V')]",
        note: "third column, top to bottom",
      },
      {
        input: 'find_motto(["abc", "def", "ghi"], "ihg")',
        output: "[(2, 2, 'H-')]",
        note: "bottom row, right to left",
      },
      {
        input: 'find_motto(["abc", "def", "ghi"], "xyz")',
        output: "[]",
        note: "motto not on the quilt",
      },
      {
        input: 'find_motto(["bob", "obo", "bob"], "bob")',
        output: "[(0, 0, 'H'), (0, 0, 'V'), (0, 2, 'H'), (0, 2, 'V-'), (2, 0, 'H-'), (2, 0, 'V'), (2, 2, 'H-'), (2, 2, 'V-')]",
        note: '"bob" backwards is still "bob" — palindromes match both ways',
      },
    ],
    tests: [
      { call: 'find_motto(["abc", "def", "ghi"], "aei")', args: '(["abc", "def", "ghi"], "aei")', expected: "[(0, 0, 'D1')]" },
      { call: 'find_motto(["abc", "def", "ghi"], "cfi")', args: '(["abc", "def", "ghi"], "cfi")', expected: "[(2, 0, 'V')]" },
      { call: 'find_motto(["abc", "def", "ghi"], "abc")', args: '(["abc", "def", "ghi"], "abc")', expected: "[(0, 0, 'H')]" },
      { call: 'find_motto(["abc", "def", "ghi"], "ihg")', args: '(["abc", "def", "ghi"], "ihg")', expected: "[(2, 2, 'H-')]" },
      { call: 'find_motto(["abc", "def", "ghi"], "xyz")', args: '(["abc", "def", "ghi"], "xyz")', expected: "[]" },
      { call: 'find_motto([], "a")', args: '([], "a")', expected: "[]" },
      { call: 'find_motto(["abc", "def", "ghi"], "")', args: '(["abc", "def", "ghi"], "")', expected: "[]" },
      { call: 'find_motto(["abc", "def", "ghi"], "a")', args: '(["abc", "def", "ghi"], "a")', expected: "[(0, 0, 'H'), (0, 0, 'H-'), (0, 0, 'V'), (0, 0, 'V-'), (0, 0, 'D1'), (0, 0, 'D1-'), (0, 0, 'D2'), (0, 0, 'D2-')]" },
      { call: 'find_motto(["aa", "aa"], "aa")', args: '(["aa", "aa"], "aa")', expected: "[(0, 0, 'H'), (0, 0, 'V'), (0, 0, 'D1'), (0, 1, 'H'), (0, 1, 'V-'), (0, 1, 'D2-'), (1, 0, 'H-'), (1, 0, 'V'), (1, 0, 'D2'), (1, 1, 'H-'), (1, 1, 'V-'), (1, 1, 'D1-')]" },
      { call: 'find_motto(["bob", "obo", "bob"], "bob")', args: '(["bob", "obo", "bob"], "bob")', expected: "[(0, 0, 'H'), (0, 0, 'V'), (0, 2, 'H'), (0, 2, 'V-'), (2, 0, 'H-'), (2, 0, 'V'), (2, 2, 'H-'), (2, 2, 'V-')]" },
      { call: 'find_motto(["b"], "b")', args: '(["b"], "b")', expected: "[(0, 0, 'H'), (0, 0, 'H-'), (0, 0, 'V'), (0, 0, 'V-'), (0, 0, 'D1'), (0, 0, 'D1-'), (0, 0, 'D2'), (0, 0, 'D2-')]" },
      { call: 'find_motto(["ab"], "abc")', args: '(["ab"], "abc")', expected: "[]" },
      { call: 'find_motto(["a", "b", "a"], "aba")', args: '(["a", "b", "a"], "aba")', expected: "[(0, 0, 'V'), (0, 2, 'V-')]" },
      { call: 'find_motto(["ab", "ba"], "ab")', args: '(["ab", "ba"], "ab")', expected: "[(0, 0, 'H'), (0, 0, 'V'), (1, 1, 'H-'), (1, 1, 'V-')]" },
      { call: 'find_motto(["Aba", "bab", "abA"], "Aba")', args: '(["Aba", "bab", "abA"], "Aba")', expected: "[(0, 0, 'H'), (0, 0, 'V'), (2, 2, 'H-'), (2, 2, 'V-')]" },
    ],
  },

  {
    id: "signpost-repaint",
    tier: 2,
    title: "Signpost Repaint",
    tagline: "Turn one village sign into another, one letter at a time.",
    icon: "signpost",
    funcName: "repaint_steps",
    topics: ["Word Ladder", "BFS"],
    stub: "def repaint_steps(start: str, end: str, wordbook: list[str]) -> int:\n    pass\n",
    story: [
      "The village renamed its main street, and Bob must repaint the old signpost into the new one. Paint is expensive and the mayor is strict: Bob may only change ONE letter per day, and every intermediate word on the sign must be a real word from the village wordbook — no gibberish allowed, even overnight.",
      "Given the start word, the end word and the wordbook, return the number of words in the SHORTEST repaint chain, counting both the start and the end word. If no chain exists, Bob returns 0 and the mayor goes back to bed.",
    ],
    signature: "def repaint_steps(start: str, end: str, wordbook: list[str]) -> int:",
    rules: [
      "Each step changes exactly one letter (the word length never changes)",
      "Every intermediate word must appear in the wordbook",
      "Return the chain length counting BOTH the start and the end word",
      "If start equals end, the chain has length 1 (even if the wordbook is empty)",
      "Return 0 if no valid chain exists",
      "If the end word is not in the wordbook (and differs from start), no chain exists",
      "All words are lowercase and have the same length",
      "The wordbook may contain words that are never used",
    ],
    examples: [
      {
        input: 'repaint_steps("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"])',
        output: "5",
        note: "hit -> hot -> dot -> dog -> cog",
      },
      {
        input: 'repaint_steps("hit", "cog", ["hot", "dot", "dog", "lot", "log"])',
        output: "0",
        note: '"cog" is not in the wordbook',
      },
      {
        input: 'repaint_steps("a", "c", ["a", "b", "c"])',
        output: "2",
        note: "a -> c directly: one letter changes",
      },
      {
        input: 'repaint_steps("same", "same", [])',
        output: "1",
        note: "already there",
      },
    ],
    tests: [
      { call: 'repaint_steps("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"])', args: '("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"])', expected: "5" },
      { call: 'repaint_steps("hit", "cog", ["hot", "dot", "dog", "lot", "log"])', args: '("hit", "cog", ["hot", "dot", "dog", "lot", "log"])', expected: "0" },
      { call: 'repaint_steps("a", "c", ["a", "b", "c"])', args: '("a", "c", ["a", "b", "c"])', expected: "2" },
      { call: 'repaint_steps("same", "same", ["same"])', args: '("same", "same", ["same"])', expected: "1" },
      { call: 'repaint_steps("same", "same", [])', args: '("same", "same", [])', expected: "1" },
      { call: 'repaint_steps("hot", "dog", ["hot", "dog"])', args: '("hot", "dog", ["hot", "dog"])', expected: "0" },
      { call: 'repaint_steps("cat", "cog", ["cat", "cot", "cog"])', args: '("cat", "cog", ["cat", "cot", "cog"])', expected: "3" },
      { call: 'repaint_steps("cat", "dog", ["cat", "cot", "cog", "dog"])', args: '("cat", "dog", ["cat", "cot", "cog", "dog"])', expected: "4" },
      { call: 'repaint_steps("cat", "dog", ["cat", "coy"])', args: '("cat", "dog", ["cat", "coy"])', expected: "0" },
      { call: 'repaint_steps("ab", "ba", ["ab", "aa", "ba"])', args: '("ab", "ba", ["ab", "aa", "ba"])', expected: "3" },
      { call: 'repaint_steps("lead", "gold", ["lead", "load", "goad", "gold"])', args: '("lead", "gold", ["lead", "load", "goad", "gold"])', expected: "4" },
      { call: 'repaint_steps("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog", "xyz", "zzz"])', args: '("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog", "xyz", "zzz"])', expected: "5" },
      { call: 'repaint_steps("abc", "abc", [])', args: '("abc", "abc", [])', expected: "1" },
      { call: 'repaint_steps("lost", "miss", ["lost", "last", "mast", "mass", "miss"])', args: '("lost", "miss", ["lost", "last", "mast", "mass", "miss"])', expected: "5" },
    ],
  },

  // -----------------------------------------------------------------------
  // DAY 3
  // -----------------------------------------------------------------------
  {
    id: "chore-wheel",
    tier: 3,
    title: "The Chore Wheel",
    tagline: "Bob's chore chart loops back on itself. Again.",
    icon: "autorenew",
    funcName: "has_chore_loop",
    topics: ["Graph Cycle Detection", "DFS"],
    stub: "def has_chore_loop(chores: dict[int, list[int]]) -> bool:\n    pass\n",
    story: [
      "Bob pinned his chore chart on the wall: every chore has a number, and under it a list of arrows to the chores that come right after it. Finishing chore 1 sends him to chore 2, and so on.",
      "The problem: some weeks the arrows loop back — chore 4 sends Bob to chore 7, chore 7 sends him to chore 2, chore 2 sends him to chore 4... and nothing ever gets done. Bob needs a function that looks at the chart and says True if following the arrows can bring him back to a chore he is already on, and False if every path eventually ends.",
    ],
    signature: "def has_chore_loop(chores: dict[int, list[int]]) -> bool:",
    rules: [
      "The chart is a dictionary: each key is a chore number, each value the list of chores it points to",
      "Return True if any directed cycle exists (following arrows can revisit a chore already on the current path)",
      "A chore pointing to itself is a loop",
      "A chore may point to a number that has no outgoing arrows (or isn't even a key) — that path simply ends there",
      "The chart may have disconnected parts; a loop anywhere counts",
      "An empty chart has no loop (return False)",
    ],
    examples: [
      {
        input: "has_chore_loop({1: [2], 2: [3], 3: []})",
        output: "False",
        note: "a straight line: 1 -> 2 -> 3 -> done",
      },
      {
        input: "has_chore_loop({1: [2], 2: [3], 3: [1]})",
        output: "True",
        note: "1 -> 2 -> 3 -> 1 -> ...",
      },
      {
        input: "has_chore_loop({1: [1]})",
        output: "True",
        note: "chore 1 points to itself",
      },
      {
        input: "has_chore_loop({0: [1, 2], 1: [3], 2: [3], 3: []})",
        output: "False",
        note: "arrows may merge — only loops matter",
      },
      {
        input: "has_chore_loop({})",
        output: "False",
      },
    ],
    tests: [
      { call: "has_chore_loop({})", args: "({},)", expected: "False" },
      { call: "has_chore_loop({1: [2], 2: [3], 3: []})", args: "({1: [2], 2: [3], 3: []},)", expected: "False" },
      { call: "has_chore_loop({1: [2], 2: [3], 3: [1]})", args: "({1: [2], 2: [3], 3: [1]},)", expected: "True" },
      { call: "has_chore_loop({1: [1]})", args: "({1: [1]},)", expected: "True" },
      { call: "has_chore_loop({1: [2], 2: [], 3: [2]})", args: "({1: [2], 2: [], 3: [2]},)", expected: "False" },
      { call: "has_chore_loop({0: [1], 1: [2], 2: [0], 3: [4], 4: []})", args: "({0: [1], 1: [2], 2: [0], 3: [4], 4: []},)", expected: "True" },
      { call: "has_chore_loop({0: [], 1: [], 2: []})", args: "({0: [], 1: [], 2: []},)", expected: "False" },
      { call: "has_chore_loop({0: [1, 2], 1: [3], 2: [3], 3: []})", args: "({0: [1, 2], 1: [3], 2: [3], 3: []},)", expected: "False" },
      { call: "has_chore_loop({0: [1], 1: [2], 2: [3], 3: [1]})", args: "({0: [1], 1: [2], 2: [3], 3: [1]},)", expected: "True" },
      { call: "has_chore_loop({1: [2]})", args: "({1: [2]},)", expected: "False" },
      { call: "has_chore_loop({0: [], 1: [2], 2: [1]})", args: "({0: [], 1: [2], 2: [1]},)", expected: "True" },
      { call: "has_chore_loop({5: [5, 6], 6: []})", args: "({5: [5, 6], 6: []},)", expected: "True" },
      { call: "has_chore_loop({10: [20], 20: [30], 30: [], 40: [50], 50: []})", args: "({10: [20], 20: [30], 30: [], 40: [50], 50: []},)", expected: "False" },
      { call: "has_chore_loop({0: [1], 1: [2], 2: [3], 3: [4], 4: [2]})", args: "({0: [1], 1: [2], 2: [3], 3: [4], 4: [2]},)", expected: "True" },
    ],
  },
];

export function getExercise(id) {
  return EXERCISES.find((ex) => ex.id === id) || null;
}

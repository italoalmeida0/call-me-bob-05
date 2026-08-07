import {
  createSignal,
  createMemo,
  Show,
  For,
  onMount,
  onCleanup,
} from "solid-js";
import { render } from "solid-js/web";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { Prec } from "@codemirror/state";

import { EXERCISES, TIERS, getExercise } from "./exercises.js";
import { initBob, grade, formatPython, runScript } from "./grader.js";

const LS_SOLVED_KEY = "bob05_solved_chores";
const LS_CODE_PREFIX = "bob05_chore_code_";
const REPO_URL = "https://github.com/italoalmeida0/call-me-bob-05";
const PREV_SITE = {
  label: "call-me-bob 04",
  url: "https://italoalmeida0.github.io/call-me-bob-04/",
};
const NEXT_SITE = null;

// Short-url service — inlined by build.ts from env SHORT_URL_API
const SHARE_API = process.env.SHORT_URL_API || "https://url.hezz.it";

// ==========================================
// ROUTING (history-aware SPA on GitHub Pages)
// The build clones dist/ into dist/<exercise-id>/ so every chore has a real
// URL; here we map the URL back to state and drive the browser history.
// ==========================================
function routeExerciseId() {
  const segments = location.pathname.replace(/\/+$/, "").split("/");
  const slug = segments[segments.length - 1];
  return getExercise(slug) ? slug : null;
}

const BASE_PATH = (() => {
  let p = location.pathname.replace(/\/+$/, "");
  if (routeExerciseId()) p = p.slice(0, p.lastIndexOf("/"));
  return p;
})();

const homeUrl = () => BASE_PATH + "/";
const exerciseUrl = (id) => `${BASE_PATH}/${id}`;

// ==========================================
// ICON SYSTEM (iconify)
// ==========================================
const svgCache = new Map();
const svgSignals = new Map();

function getIconUrl(name, color = "e7e5e4", size = 24) {
  return `https://api.iconify.design/material-symbols/${name}.svg?color=%23${color}&height=${size}`;
}

function fetchIcon(name, color, size) {
  const key = `${name}|${color}|${size}`;
  if (svgCache.has(key)) return svgCache.get(key);
  if (svgSignals.has(key)) return svgSignals.get(key);

  const [svg, setSvg] = createSignal("");
  svgSignals.set(key, svg);

  fetch(getIconUrl(name, color, size))
    .then((r) => r.text())
    .then((text) => {
      svgCache.set(key, text);
      setSvg(text);
      svgSignals.delete(key);
    })
    .catch(() => {});

  return svg();
}

const Icon = (props) => {
  const name = () => props.name;
  const color = () => props.color || "e7e5e4";
  const size = () => props.size || 24;
  const key = () => `${name()}|${color()}|${size()}`;

  const svgContent = createMemo(() => {
    const k = key();
    if (svgCache.has(k)) return svgCache.get(k);
    fetchIcon(name(), color(), size());
    const sig = svgSignals.get(k);
    return sig ? sig() : "";
  });

  return (
    <Show when={svgContent()}>
      <div
        innerHTML={svgContent()}
        class={`inline-flex items-center justify-center ${props.class || ""}`}
        style={{ width: `${size()}px`, height: `${size()}px` }}
      />
    </Show>
  );
};

// ==========================================
// PERSISTENCE
// ==========================================
function loadSolved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_SOLVED_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}

function saveSolved(solved) {
  try {
    localStorage.setItem(LS_SOLVED_KEY, JSON.stringify([...solved]));
  } catch (e) {}
}

function loadCode(ex) {
  try {
    const saved = localStorage.getItem(LS_CODE_PREFIX + ex.id);
    return saved !== null ? saved : ex.stub;
  } catch (e) {
    return ex.stub;
  }
}

function saveCode(ex, code) {
  try {
    localStorage.setItem(LS_CODE_PREFIX + ex.id, code);
  } catch (e) {}
}

// ==========================================
// SHARE LINKS (#base64-encoded code in the URL hash)
// ==========================================
function encodeCodeHash(code) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(code)));
}

// If the URL carries a shared-code hash, it wins over localStorage.
// The hash is left in place so F5 keeps showing the shared code; the
// visitor's own saved code is only replaced once they start editing
// (the usual debounced save then kicks in).
function decodeSharedCode() {
  try {
    const h = location.hash.slice(1);
    if (!h || !/^[A-Za-z0-9+/=]+$/.test(h)) return null;
    const bytes = Uint8Array.from(atob(h), (c) => c.charCodeAt(0));
    if (!bytes.length || bytes.length > 200_000) return null; // sanity cap
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

// Captured at startup — App's history shim rewrites the URL before the
// practice screen mounts, which would otherwise drop the shared-code hash.
const INITIAL_SHARED = (() => {
  const code = decodeSharedCode();
  const exId = routeExerciseId();
  return code && exId ? { exId, code } : null;
})();

// ==========================================
// TAB = 4 SPACES (Bob's robot hates \t)
// ==========================================
const FOUR_SPACES = "    ";

function insertFourSpaces(view) {
  const { state } = view;
  const hasSelection = state.selection.ranges.some((r) => !r.empty);

  // Plain cursor: insert four spaces at the caret
  if (!hasSelection) {
    view.dispatch(state.replaceSelection(FOUR_SPACES));
    return true;
  }

  // With a selection: indent every selected line instead of replacing it
  const changes = [];
  const seen = new Set();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    // A selection ending exactly at a line start doesn't include that line
    if (range.to === state.doc.line(last).from) last -= 1;
    for (let n = first; n <= last; n++) {
      const from = state.doc.line(n).from;
      if (seen.has(from)) continue;
      seen.add(from);
      changes.push({ from, insert: FOUR_SPACES });
    }
  }
  view.dispatch({ changes, userEvent: "input" });
  return true;
}

function removeFourSpaces(view) {
  const { state } = view;
  const changes = [];
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    // A selection ending exactly at a line start doesn't include that line
    if (range.from !== range.to && range.to === state.doc.line(last).from) {
      last -= 1;
    }
    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      let count = 0;
      while (count < 4 && line.text[count] === " ") count++;
      if (count > 0) changes.push({ from: line.from, to: line.from + count });
    }
  }
  if (!changes.length) return true;
  view.dispatch({ changes, userEvent: "delete" });
  return true;
}

// ==========================================
// PRACTICE SCREEN
// ==========================================
function PracticeScreen(props) {
  const ex = () => props.exercise;

  const [grading, setGrading] = createSignal(false);
  const [formatting, setFormatting] = createSignal(false);
  const [running, setRunning] = createSignal(false);
  const [trace, setTrace] = createSignal(null); // { fatal } | { results, passed } | { run }
  const [leftTab, setLeftTab] = createSignal("note"); // "note" | "log"
  const [confirmReset, setConfirmReset] = createSignal(false);
  const [sharing, setSharing] = createSignal(false);
  const [sharedOk, setSharedOk] = createSignal(false);

  let editorContainerRef;
  let traceRef;
  let cmView = null;
  let saveTimeout = null;

  onMount(() => {
    cmView = new EditorView({
      doc:
        INITIAL_SHARED && INITIAL_SHARED.exId === ex().id
          ? INITIAL_SHARED.code
          : loadCode(ex()),
      extensions: [
        basicSetup,
        keymap.of([
          { key: "Tab", run: insertFourSpaces },
          { key: "Shift-Tab", run: removeFourSpaces },
        ]),
        indentationMarkers(),
        python(),
        vscodeDark,
        Prec.highest(
          keymap.of([
            { key: "Mod-s", run: () => true },
            {
              key: "Mod-Enter",
              run: () => {
                runGrader();
                return true;
              },
            },
          ]),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const code = update.state.doc.toString();
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => saveCode(ex(), code), 2000);
          }
        }),
      ],
      parent: editorContainerRef,
    });
  });

  onMount(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") setConfirmReset(false);
    };
    window.addEventListener("keydown", onEsc);
    onCleanup(() => window.removeEventListener("keydown", onEsc));
  });

  onCleanup(() => {
    if (cmView) cmView.destroy();
    if (saveTimeout) clearTimeout(saveTimeout);
  });

  const runGrader = async () => {
    if (grading() || props.pyodideState() !== "ready") return;
    setGrading(true);
    setTrace(null);
    try {
      const code = cmView.state.doc.toString();
      const result = await grade(code, ex());
      setTrace(result);
      setLeftTab("log");
      if (result.passed) {
        props.onSolved(ex().id);
      }
    } catch (err) {
      setTrace({ fatal: String(err && err.message ? err.message : err) });
      setLeftTab("log");
    } finally {
      setGrading(false);
      setTimeout(() => {
        if (traceRef) traceRef.scrollTop = traceRef.scrollHeight;
      }, 50);
    }
  };

  const runCode = async () => {
    if (
      running() ||
      grading() ||
      formatting() ||
      props.pyodideState() !== "ready"
    )
      return;
    setRunning(true);
    setLeftTab("log");
    try {
      const code = cmView.state.doc.toString();
      const out = await runScript(code);
      setTrace({ run: out });
    } catch (err) {
      setTrace({ fatal: String(err && err.message ? err.message : err) });
    } finally {
      setRunning(false);
      setTimeout(() => {
        if (traceRef) traceRef.scrollTop = traceRef.scrollHeight;
      }, 50);
    }
  };

  const shareCode = async () => {
    if (sharing()) return;
    setSharing(true);
    try {
      const code = cmView.state.doc.toString();
      const longUrl = `${location.origin}${exerciseUrl(ex().id)}#${encodeCodeHash(code)}`;
      const res = await fetch(`${SHARE_API}/${encodeURIComponent(longUrl)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data && data.error ? data.error : `HTTP ${res.status}`);
      }
      try {
        await navigator.clipboard.writeText(data.short);
      } catch {
        window.prompt("Copy your share link:", data.short);
      }
      setSharedOk(true);
      setTimeout(() => setSharedOk(false), 2500);
    } catch (err) {
      setLeftTab("log");
      setTrace({
        fatal: `Couldn't create a share link: ${err.message || err}`,
      });
    } finally {
      setSharing(false);
    }
  };

  const resetCode = () => setConfirmReset(true);

  const doReset = (clearStatus) => {
    setConfirmReset(false);
    // Skip the 2s CodeMirror save debounce: cancel any pending save and
    // persist the stub right away, so a quick F5 can't resurrect old code.
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    cmView.dispatch({
      changes: { from: 0, to: cmView.state.doc.length, insert: ex().stub },
    });
    saveCode(ex(), ex().stub);
    setTrace(null);
    if (clearStatus) props.onUnsolved(ex().id);
  };

  const formatCode = async () => {
    if (formatting() || grading() || props.pyodideState() !== "ready") return;
    setFormatting(true);
    try {
      const code = cmView.state.doc.toString();
      const formatted = await formatPython(code);
      if (formatted !== code) {
        cmView.dispatch({
          changes: { from: 0, to: cmView.state.doc.length, insert: formatted },
          userEvent: "input",
        });
      }
    } catch (err) {
      setLeftTab("log");
      setTrace({
        fatal: "Black couldn't format this code: " + err.message,
      });
    } finally {
      setFormatting(false);
    }
  };

  const gradeDisabled = () => grading() || props.pyodideState() !== "ready";

  return (
    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Practice header — two rows on mobile, one row on sm+ */}
      <div class="bg-[#1c1917] border-b border-[#292524] px-3 py-2 shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="flex items-center gap-2 min-w-0 sm:flex-1">
          <button
            onClick={props.onBack}
            class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#292524] hover:bg-[#44403c] text-[#a8a29e] text-xs font-semibold transition-colors shrink-0 shadow-[0_3px_0_#0c0a09] active:translate-y-[2px] active:shadow-none"
          >
            <Icon name="arrow-back" color="a8a29e" size={14} />
            <span>Chores</span>
          </button>
          <div class="flex items-center gap-2 min-w-0">
            <div class="bg-[#78350f] p-1 rounded-md shrink-0 flex items-center justify-center">
              <Icon name={ex().icon} color="fbbf24" size={16} />
            </div>
            <span class="text-sm font-bold text-[#e7e5e4] truncate">
              {ex().title}
            </span>
            <Show when={props.solved().has(ex().id)}>
              <Icon name="star" color="fbbf24" size={16} />
            </Show>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={shareCode}
            disabled={sharing()}
            class="p-2 rounded-lg bg-[#292524] hover:bg-[#44403c] disabled:opacity-50 disabled:cursor-not-allowed text-[#a8a29e] transition-colors flex shrink-0 shadow-[0_3px_0_#0c0a09] active:translate-y-[2px] active:shadow-none"
            title="Share code"
          >
            <Icon
              name={
                sharing() ? "hourglass-top" : sharedOk() ? "check" : "share"
              }
              color={sharedOk() ? "34d399" : "a8a29e"}
              size={16}
            />
          </button>
          <button
            onClick={resetCode}
            class="p-2 rounded-lg bg-[#292524] hover:bg-[#44403c] text-[#a8a29e] transition-colors flex shrink-0 shadow-[0_3px_0_#0c0a09] active:translate-y-[2px] active:shadow-none"
            title="Reset code"
          >
            <Icon name="restart-alt" color="a8a29e" size={16} />
          </button>
          <button
            onClick={formatCode}
            disabled={formatting() || props.pyodideState() !== "ready"}
            class="p-2 rounded-lg bg-[#292524] hover:bg-[#44403c] disabled:opacity-50 disabled:cursor-not-allowed text-[#a8a29e] transition-colors flex shrink-0 shadow-[0_3px_0_#0c0a09] active:translate-y-[2px] active:shadow-none"
            title="Format code"
          >
            <Icon
              name={formatting() ? "hourglass-top" : "format-align-left"}
              color="a8a29e"
              size={16}
            />
          </button>
          <button
            onClick={runCode}
            disabled={
              running() || grading() || props.pyodideState() !== "ready"
            }
            class="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#022c22] transition-colors flex shrink-0 shadow-[0_3px_0_#065f46] active:translate-y-[2px] active:shadow-none"
            title="Run script"
          >
            <Icon
              name={running() ? "hourglass-top" : "play-arrow"}
              color="022c22"
              size={16}
            />
          </button>
          <button
            onClick={runGrader}
            disabled={gradeDisabled()}
            class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#451a03] text-sm font-extrabold transition-colors shadow-[0_3px_0_#92400e] active:translate-y-[2px] active:shadow-none"
            title={
              props.pyodideState() !== "ready"
                ? "Waking up..."
                : "Grade me!"
            }
          >
            <Icon name="smart-toy" color="451a03" size={16} />
            <span>{grading() ? "Grading..." : "Grade me!"}</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left panel: subject / robot log tabs */}
        <div class="shrink-0 lg:w-[420px] xl:w-[460px] bg-[#1c1917] border-b lg:border-b-0 lg:border-r border-[#292524] flex flex-col min-h-0 max-h-[55%] lg:max-h-none">
          {/* Tab content */}
          <div ref={traceRef} class="flex-1 overflow-auto min-h-0">
            <Show
              when={leftTab() === "note"}
              fallback={
                <div class="px-4 py-3 font-mono text-[12px]">
                  <Show
                    when={trace()}
                    fallback={
                      <div class="text-[#57534e] font-sans text-sm px-1 py-4 text-center">
                        <div class="flex justify-center mb-2 opacity-50">
                          <Icon name="smart-toy" color="57534e" size={32} />
                        </div>
                        No runs yet. Hit{" "}
                        <span class="font-bold text-amber-500">Grade me!</span>{" "}
                        and Bob's robot will check your code here.
                      </div>
                    }
                  >
                    {(t) => (
                      <div>
                        <Show when={t().run}>
                          {(r) => (
                            <div>
                              <div class="trace-header mb-1">
                                ===== run =====
                              </div>
                              <Show
                                when={r().stdout}
                                fallback={
                                  <div class="text-[#78716c]">
                                    (no output — try a print() in there)
                                  </div>
                                }
                              >
                                <div class="whitespace-pre text-[#d6d3d1]">
                                  {r().stdout}
                                </div>
                              </Show>
                              <Show when={r().error === "timeout"}>
                                <div class="trace-fail mt-1">
                                  Stopped after 15 seconds — looks like an
                                  infinite loop!
                                </div>
                              </Show>
                              <Show when={r().error === "output_limit"}>
                                <div class="trace-fail mt-1">
                                  Output limit reached — your script prints WAY
                                  too much.
                                </div>
                              </Show>
                              <Show
                                when={
                                  r().error &&
                                  r().error !== "timeout" &&
                                  r().error !== "output_limit"
                                }
                              >
                                <div class="trace-error mt-1">{r().error}</div>
                              </Show>
                            </div>
                          )}
                        </Show>
                        <Show when={t().fatal}>
                          <div class="trace-header mb-1">===== oops =====</div>
                          <div class="trace-fail">{t().fatal}</div>
                          <div class="text-[#78716c] mt-1">
                            Bob's robot couldn't even read your code. Fix it and
                            hit Grade me! again.
                          </div>
                        </Show>
                        <Show when={t().results}>
                          <div class="trace-header mb-1">===== trace =====</div>
                          <For each={t().results}>
                            {(r, i) => (
                              <div class="mb-1.5">
                                <div class="trace-line-call whitespace-pre">
                                  <span class="test-num">Test {i() + 1}:</span>
                                  <span class={r.ok ? "trace-ok" : "trace-ko"}>
                                    [{r.ok ? "OK" : "KO"}]
                                  </span>
                                  {" -> "}
                                  {r.call}
                                </div>
                                <div class="trace-line-val whitespace-pre">
                                  <span class="trace-label">expected:</span>{" "}
                                  {r.expected}
                                </div>
                                <div class="trace-line-val whitespace-pre">
                                  <span class="trace-label">got:</span>{" "}
                                  {r.got === null ? "—" : r.got}
                                </div>
                                <Show when={r.error}>
                                  <div class="trace-error whitespace-pre">
                                    {r.error}
                                  </div>
                                </Show>
                              </div>
                            )}
                          </For>
                          <div class="trace-header mt-2">=================</div>
                          <Show
                            when={t().passed}
                            fallback={
                              <div class="trace-fail mt-1">
                                Not yet. Some tests failed — tweak your code and
                                try again!
                              </div>
                            }
                          >
                            <div class="success-banner mt-3 mb-1 bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap font-sans">
                              <Icon
                                name="celebration"
                                color="4ade80"
                                size={24}
                              />
                              <div class="flex-1 min-w-[180px]">
                                <div class="text-emerald-300 font-extrabold text-sm">
                                  Chore complete! Bob owes you one.
                                </div>
                                <div class="text-emerald-500/80 text-xs">
                                  All {t().results.length} tests passed.
                                </div>
                              </div>
                              <button
                                onClick={props.onNext}
                                class="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                              >
                                <span>Next chore</span>
                                <Icon
                                  name="arrow-forward"
                                  color="ffffff"
                                  size={14}
                                />
                              </button>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    )}
                  </Show>
                </div>
              }
            >
              <div class="px-5 py-4">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] font-bold uppercase tracking-widest text-[#57534e]">
                    {TIERS[ex().tier - 1].label} ·{" "}
                    {TIERS[ex().tier - 1].subtitle}
                  </span>
                </div>
                <h2 class="text-xl font-black text-amber-400 mb-2">
                  {ex().title}
                </h2>
                <Show when={ex().topics}>
                  <div class="flex flex-wrap gap-1.5 mb-3">
                    <For each={ex().topics}>
                      {(topic) => (
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#292524] border border-[#44403c] text-amber-500/90">
                          {topic}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>

                <For each={ex().story}>
                  {(p) => (
                    <p class="text-sm text-[#d6d3d1] leading-relaxed mb-3">
                      {p}
                    </p>
                  )}
                </For>

                <div class="bg-[#0c0a09] border border-[#292524] rounded-lg px-3 py-2 mb-4">
                  <code class="text-[13px] text-emerald-400 font-mono break-all">
                    {ex().signature}
                  </code>
                </div>

                <h3 class="text-[11px] font-bold uppercase tracking-widest text-[#78716c] mb-2">
                  The rules
                </h3>
                <ul class="mb-5 space-y-1.5">
                  <For each={ex().rules}>
                    {(rule) => (
                      <li class="flex items-start gap-2 text-sm text-[#d6d3d1]">
                        <span class="text-amber-500 mt-0.5 shrink-0">
                          <Icon name="check-small" color="f59e0b" size={16} />
                        </span>
                        <span>{rule}</span>
                      </li>
                    )}
                  </For>
                </ul>

                <h3 class="text-[11px] font-bold uppercase tracking-widest text-[#78716c] mb-2">
                  Examples
                </h3>
                <div class="space-y-2 pb-2">
                  <For each={ex().examples}>
                    {(example) => (
                      <div class="bg-[#0c0a09] border border-[#292524] rounded-lg px-3 py-2">
                        <div class="text-[12px] font-mono text-sky-300 break-all">
                          {example.input}
                        </div>
                        <div class="text-[12px] font-mono text-[#a8a29e] break-all">
                          <span class="text-[#57534e]">→ </span>
                          {example.output}
                        </div>
                        <Show when={example.note}>
                          <div class="text-[11px] text-[#78716c] mt-1 italic">
                            {example.note}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          {/* Tab bar */}
          <div class="shrink-0 flex border-t border-[#292524]">
            <button
              onClick={() => setLeftTab("note")}
              class={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors border-t-2 ${
                leftTab() === "note"
                  ? "bg-[#0c0a09] text-amber-400 border-amber-500"
                  : "text-[#78716c] hover:text-[#a8a29e] border-transparent"
              }`}
            >
              <Icon
                name="menu-book"
                color={leftTab() === "note" ? "fbbf24" : "78716c"}
                size={14}
              />
              <span>Bob's note</span>
            </button>
            <button
              onClick={() => setLeftTab("log")}
              class={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors border-t-2 ${
                leftTab() === "log"
                  ? "bg-[#0c0a09] text-amber-400 border-amber-500"
                  : "text-[#78716c] hover:text-[#a8a29e] border-transparent"
              }`}
            >
              <Icon
                name="smart-toy"
                color={leftTab() === "log" ? "fbbf24" : "78716c"}
                size={14}
              />
              <span>Robot log</span>
              <Show when={trace() && trace().results}>
                <span
                  class={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-black ${
                    trace().passed
                      ? "bg-emerald-900/60 text-emerald-300"
                      : "bg-red-900/60 text-red-300"
                  }`}
                >
                  {trace().results.filter((r) => r.ok).length}/
                  {trace().results.length}
                </span>
              </Show>
            </button>
          </div>
        </div>

        {/* Editor */}
        <div class="flex-1 relative min-h-0 overflow-hidden bg-[#1e1e1e]">
          <div ref={editorContainerRef} class="absolute inset-0"></div>
        </div>
      </div>

      {/* Reset confirmation modal */}
      <Show when={confirmReset()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setConfirmReset(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            class="w-full max-w-sm bg-[#1c1917] border-2 border-[#292524] rounded-2xl p-5 flex flex-col gap-4 shadow-[0_8px_0_#0c0a09]"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-start gap-3">
              <div class="bg-[#78350f] p-2 rounded-lg shrink-0 flex items-center justify-center">
                <Icon name="restart-alt" color="fbbf24" size={20} />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-[#e7e5e4]">
                  Start this chore over?
                </div>
                <p class="text-xs text-[#a8a29e] leading-relaxed mt-1">
                  Your current code will be replaced by the original stub. This
                  can't be undone.
                </p>
              </div>
            </div>

            <Show when={props.solved().has(ex().id)}>
              <div class="flex items-start gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <span class="shrink-0 mt-px flex">
                  <Icon name="star" color="fbbf24" size={14} />
                </span>
                <span>
                  You already earned the star on this chore. Pick{" "}
                  <span class="font-bold">Reset Code and Status</span> to wipe
                  that too, as if you never solved it.
                </span>
              </div>
            </Show>

            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                class="px-4 py-2 rounded-lg bg-[#292524] hover:bg-[#44403c] text-[#a8a29e] text-sm font-semibold transition-colors shadow-[0_3px_0_#0c0a09] active:translate-y-[2px] active:shadow-none"
              >
                Cancel
              </button>
              <Show when={props.solved().has(ex().id)}>
                <button
                  onClick={() => doReset(true)}
                  class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors shadow-[0_3px_0_#7f1d1d] active:translate-y-[2px] active:shadow-none"
                  title="Reset the code and remove the star for this chore"
                >
                  Reset Code and Status
                </button>
              </Show>
              <button
                onClick={() => doReset(false)}
                class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#451a03] text-sm font-extrabold transition-colors shadow-[0_3px_0_#92400e] active:translate-y-[2px] active:shadow-none"
              >
                Reset Code
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ==========================================
// HOME SCREEN (chore list)
// ==========================================
function HomeScreen(props) {
  const solvedCount = () =>
    EXERCISES.filter((e) => props.solved().has(e.id)).length;

  return (
    <div class="flex-1 overflow-y-auto min-h-0">
      <div class="max-w-4xl mx-auto px-5 py-8 md:py-12">
        {/* Hero */}
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center bg-[#78350f] p-3 rounded-2xl mb-4 rotate-[-3deg]">
            <Icon name="smart-toy" color="fbbf24" size={44} />
          </div>
          <h1 class="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
            call-me-<span class="text-amber-400">bob</span>
          </h1>
          <div class="inline-flex items-center gap-1.5 bg-[#292524] border border-[#44403c] rounded-full px-3 py-1 mb-4">
            <Icon name="checklist" color="f59e0b" size={14} />
            <span class="text-[11px] font-bold uppercase tracking-widest text-[#a8a29e]">
              To-Do List #05
            </span>
          </div>
          <p class="text-[#a8a29e] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Bob has a to-do list. You have Python. Help Bob tally his crates,
            book the barns, plant the coil garden and untangle his chore wheel —
            one chore at a time, right in your browser.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-4 inline-flex items-center gap-2 bg-[#292524] hover:bg-[#44403c] border border-[#44403c] rounded-full px-4 py-1.5 text-xs font-bold text-[#e7e5e4] transition-colors"
          >
            <Icon name="star" color="fbbf24" size={14} />
            <span>Liked it? Give Bob a star on GitHub</span>
          </a>
          <div class="mt-5 flex items-center justify-center gap-3">
            <div class="w-48 h-2.5 bg-[#292524] rounded-full overflow-hidden">
              <div
                class="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{
                  width: `${(solvedCount() / EXERCISES.length) * 100}%`,
                }}
              ></div>
            </div>
            <span class="text-xs font-bold text-[#78716c]">
              {solvedCount()}/{EXERCISES.length} chores done
            </span>
          </div>
        </div>

        {/* Tiers */}
        <For each={TIERS}>
          {(tier) => {
            const tierExercises = () =>
              EXERCISES.filter((e) => e.tier === tier.tier);
            return (
              <Show when={tierExercises().length > 0}>
                <div class="mb-8">
                  <div class="flex items-baseline gap-2 mb-3">
                    <h2 class="text-sm font-black uppercase tracking-widest text-amber-500">
                      {tier.label}
                    </h2>
                    <span class="text-xs text-[#57534e] font-semibold">
                      {tier.subtitle}
                    </span>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <For each={tierExercises()}>
                      {(ex) => (
                        <button
                          onClick={() => props.onPick(ex.id)}
                          class="chore-card text-left bg-[#1c1917] border-2 border-[#292524] hover:border-amber-600/60 rounded-2xl p-5 flex items-start gap-4"
                        >
                          <div class="bg-[#78350f] p-2.5 rounded-xl shrink-0 flex items-center justify-center">
                            <Icon name={ex.icon} color="fbbf24" size={26} />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <h3 class="font-bold text-white">{ex.title}</h3>
                              <Show when={props.solved().has(ex.id)}>
                                <Icon name="star" color="fbbf24" size={16} />
                              </Show>
                            </div>
                            <p class="text-sm text-[#a8a29e] mt-1">
                              {ex.tagline}
                            </p>
                            <Show when={ex.topics}>
                              <div class="flex flex-wrap gap-1.5 mt-2">
                                <For each={ex.topics}>
                                  {(topic) => (
                                    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#292524] border border-[#44403c] text-amber-500/90">
                                      {topic}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                          <div class="shrink-0 mt-1 text-[#57534e]">
                            <Icon
                              name="chevron-right"
                              color="57534e"
                              size={20}
                            />
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            );
          }}
        </For>

        <p class="text-center text-xs text-[#57534e] pb-6">
          No timers, no pressure. Bob grades with his little robot helper — it
          runs entirely in your browser.
        </p>

        {/* Sibling to-do lists */}
        <div class="flex items-center justify-center gap-2 pb-8">
          <Show when={PREV_SITE}>
            {(s) => (
              <a
                href={s().url}
                class="inline-flex items-center gap-2 bg-[#292524] hover:bg-[#44403c] border border-[#44403c] rounded-full px-4 py-1.5 text-xs font-bold text-[#e7e5e4] transition-colors"
              >
                <Icon name="arrow-back" color="a8a29e" size={14} />
                <span>{s().label}</span>
              </a>
            )}
          </Show>
          <Show when={NEXT_SITE}>
            {(s) => (
              <a
                href={s().url}
                class="inline-flex items-center gap-2 bg-[#292524] hover:bg-[#44403c] border border-[#44403c] rounded-full px-4 py-1.5 text-xs font-bold text-[#e7e5e4] transition-colors"
              >
                <span>{s().label}</span>
                <Icon name="arrow-forward" color="a8a29e" size={14} />
              </a>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// APP
// ==========================================
function App() {
  const [currentId, setCurrentId] = createSignal(routeExerciseId());
  const [solved, setSolved] = createSignal(loadSolved());
  const [pyodideState, setPyodideState] = createSignal("loading");
  const [pyodideText, setPyodideText] = createSignal(
    "Waking up Bob's robot helper...",
  );

  const currentExercise = createMemo(() => getExercise(currentId()));

  onMount(() => {
    // Opened via a direct chore link (F5 / shared URL): slip Home underneath
    // in history so the browser Back button stays inside the site.
    if (currentId()) {
      // Keep a shared-code #hash alive across the history shim (F5-safe)
      const hash = location.hash;
      history.replaceState(null, "", homeUrl());
      history.pushState(null, "", exerciseUrl(currentId()) + hash);
    }
    const onPopState = () => setCurrentId(routeExerciseId());
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));
  });

  onMount(async () => {
    try {
      await initBob((state, text) => {
        setPyodideState(state);
        setPyodideText(text);
      });
    } catch (err) {
      setPyodideState("error");
      setPyodideText("Robot helper failed to load: " + err.message);
      console.error("Pyodide loading error:", err);
    }
  });

  const pickExercise = (id) => {
    history.pushState(null, "", exerciseUrl(id));
    setCurrentId(id);
  };

  const goHome = () => {
    history.pushState(null, "", homeUrl());
    setCurrentId(null);
  };

  const markSolved = (id) => {
    const next = new Set(solved());
    next.add(id);
    setSolved(next);
    saveSolved(next);
  };

  const markUnsolved = (id) => {
    if (!solved().has(id)) return;
    const next = new Set(solved());
    next.delete(id);
    setSolved(next);
    saveSolved(next);
  };

  // Next-chore order follows the day tiers (Day 1 → last), matching the
  // home list — the raw EXERCISES array is NOT sorted by tier.
  const orderedExercises = TIERS.flatMap((t) =>
    EXERCISES.filter((e) => e.tier === t.tier),
  );

  const nextChore = () => {
    const idx = orderedExercises.findIndex((e) => e.id === currentId());
    const unsolved = orderedExercises
      .slice(idx + 1)
      .find((e) => !solved().has(e.id));
    const fallback = orderedExercises.find((e) => !solved().has(e.id));
    const next = unsolved || fallback;
    if (next) {
      pickExercise(next.id);
    } else {
      goHome();
    }
  };

  return (
    <div class="h-full flex flex-col overflow-hidden">
      <Show
        when={currentExercise()}
        keyed
        fallback={<HomeScreen solved={solved} onPick={pickExercise} />}
      >
        {(ex) => (
          <PracticeScreen
            exercise={ex}
            solved={solved}
            pyodideState={pyodideState}
            onBack={goHome}
            onSolved={markSolved}
            onUnsolved={markUnsolved}
            onNext={nextChore}
          />
        )}
      </Show>

      {/* Status bar */}
      <div class="status-bar">
        <span class={`status-dot ${pyodideState()}`}></span>
        <span class="text-[#57534e]">{pyodideText()}</span>
        <span class="flex-1"></span>
        <span class="text-[#44403c]">call-me-bob 05</span>
      </div>
    </div>
  );
}

render(() => <App />, document.getElementById("root"));

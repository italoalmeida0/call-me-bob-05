/**
 * grader.js — Bob's little robot helper.
 *
 * Pyodide runs entirely inside a Web Worker (see pyodide.worker.js), so
 * the UI thread never blocks — not while Pyodide boots, not while it
 * grades, and not when player code loops forever. forceStop() kills the
 * worker and starts a fresh one, which is the only way to break a
 * runaway Python loop without freezing the page.
 *
 * The grading harness (HARNESS below) is unchanged: it still uses a
 * sys.settrace time guard (15s) as a safety net, but the real
 * kill-switch is now the user-driven force-stop after 3s.
 */

const HARNESS = `
import copy as _bob_copy
import json as _bob_json
import ast as _bob_ast
import sys as _bob_sys
import time as _bob_time
import io as _bob_io
from contextlib import redirect_stdout as _bob_redirect_stdout

# ---------------------------------------------------------------------
# Time guard: a sys.settrace hook that raises _BobTimeout after
# 'limit_seconds' of user code — catches infinite loops even though
# browser Python can't be killed mid-run. It inherits BaseException so
# a bare 'except Exception' in player code can't swallow it.
# ---------------------------------------------------------------------
class _BobTimeout(BaseException):
    pass

class _BobLimitedStdout(_bob_io.StringIO):
    _LIMIT = 200000
    def write(self, s):
        room = self._LIMIT - self.tell()
        if len(s) > room:
            super().write(s[: max(0, room)])
            raise _BobTimeout("output_limit")
        return super().write(s)

def _bob_time_guard(limit_seconds):
    deadline = _bob_time.monotonic() + limit_seconds
    ticks = [0]
    def _tracer(frame, event, arg):
        if event == "line":
            ticks[0] += 1
            if ticks[0] >= 200:
                ticks[0] = 0
                if _bob_time.monotonic() > deadline:
                    raise _BobTimeout("time")
        return _tracer
    return _tracer

_TIMEOUT_MSG = "TimeLimit: your code ran for more than 15s — looks like an infinite loop!"

# ---------------------------------------------------------------------
# Banned-call detection (used by The Chore Wheel and friends).
# Layer 1 — AST: any *use* of a banned name/attribute (even aliasing
# like f = sorted), plus banned MODULE imports so tricks like
# 'from graphlib import TopologicalSorter as T' are caught at the
# import itself. String constants handed to getattr/eval/exec are
# inspected too.
# Layer 2 — runtime: banned builtins are replaced by tripwires BEFORE
# the player's code runs, so dynamic tricks like
# __builtins__['sorted'](x) or import builtins; builtins.sorted(x)
# blow up too. Originals are restored after grading.
# ---------------------------------------------------------------------
class _BobBannedUse(BaseException):
    def __init__(self, name):
        super().__init__(name)
        self.name = name

def _bob_find_banned(user_src, banned_names, banned_attrs, banned_modules):
    try:
        tree = _bob_ast.parse(user_src)
    except Exception:
        return None  # syntax errors are reported by exec() later
    for node in _bob_ast.walk(tree):
        if isinstance(node, _bob_ast.Name) and isinstance(node.ctx, _bob_ast.Load):
            if node.id in banned_names:
                return node.id + "()"
        if isinstance(node, _bob_ast.Attribute) and isinstance(node.ctx, _bob_ast.Load):
            if node.attr in banned_attrs:
                return "." + node.attr + "()"
        if isinstance(node, _bob_ast.Import):
            for alias in node.names:
                if alias.name in banned_modules:
                    return "import " + alias.name
        if isinstance(node, _bob_ast.ImportFrom):
            if node.module in banned_modules:
                return "import " + node.module
        if isinstance(node, _bob_ast.Call):
            f = node.func
            fname = None
            if isinstance(f, _bob_ast.Name):
                fname = f.id
            elif isinstance(f, _bob_ast.Attribute):
                fname = f.attr
            if fname in ("getattr", "vars"):
                for a in node.args:
                    if isinstance(a, _bob_ast.Constant) and isinstance(a.value, str):
                        if a.value in banned_names or a.value in banned_attrs:
                            return a.value + "()"
            if fname in ("eval", "exec", "compile"):
                for a in node.args:
                    if isinstance(a, _bob_ast.Constant) and isinstance(a.value, str):
                        words = a.value.replace("(", " ").replace(")", " ").replace(".", " ").split()
                        for w in words:
                            if w in banned_names or w in banned_attrs or w in banned_modules:
                                return w + "()"
    return None

def _bob_patch_builtins(banned_names):
    import builtins as _bob_b
    patched = {}
    for name in banned_names:
        if hasattr(_bob_b, name):
            real = getattr(_bob_b, name)
            def _make_tripwire(n):
                def _tripwire(*a, **k):
                    raise _BobBannedUse(n + "()")
                return _tripwire
            setattr(_bob_b, name, _make_tripwire(name))
            patched[name] = real
    return patched

def _bob_restore_builtins(patched):
    import builtins as _bob_b
    for name, real in patched.items():
        setattr(_bob_b, name, real)

def _bob_forbidden(bad):
    return _bob_json.dumps({
        "fatal": f"Forbidden function '{bad}' detected. This chore bans it — read the rules and solve it by hand!"
    })

def bob_grade(user_src, func_name, tests_literal, banned_literal, timeout_seconds=15):
    banned = _bob_json.loads(banned_literal)
    bad = _bob_find_banned(
        user_src,
        banned.get("names", []),
        banned.get("attrs", []),
        banned.get("modules", []),
    )
    if bad:
        return _bob_forbidden(bad)

    patched = _bob_patch_builtins(banned.get("names", []))
    try:
        ns = {}
        _bob_sys.settrace(_bob_time_guard(timeout_seconds))
        try:
            exec(user_src, ns)
        except _BobBannedUse as b:
            return _bob_forbidden(b.name)
        except _BobTimeout:
            return _bob_json.dumps({"fatal": _TIMEOUT_MSG})
        except Exception as e:
            return _bob_json.dumps({"fatal": f"{type(e).__name__}: {e}"})
        finally:
            _bob_sys.settrace(None)

        func = ns.get(func_name)
        if not callable(func):
            return _bob_json.dumps({
                "fatal": f"Function '{func_name}' not found. Check the 'def' line in the subject."
            })

        tests = eval(tests_literal)
        results = []
        for fname, args, expected in tests:
            test_func = ns.get(fname)
            if not callable(test_func):
                results.append({
                    "ok": False,
                    "expected": repr(expected),
                    "got": None,
                    "error": f"Function '{fname}' not found. Check the 'def' line in the subject.",
                })
                continue
            _bob_sys.settrace(_bob_time_guard(timeout_seconds))
            try:
                got = test_func(*_bob_copy.deepcopy(args))
                results.append({
                    "ok": bool(got == expected),
                    "expected": repr(expected),
                    "got": repr(got),
                    "error": None,
                })
            except _BobBannedUse as b:
                return _bob_forbidden(b.name)
            except _BobTimeout:
                results.append({
                    "ok": False,
                    "expected": repr(expected),
                    "got": None,
                    "error": _TIMEOUT_MSG,
                })
            except Exception as e:
                results.append({
                    "ok": False,
                    "expected": repr(expected),
                    "got": None,
                    "error": f"{type(e).__name__}: {e}",
                })
            finally:
                _bob_sys.settrace(None)
        return _bob_json.dumps({"results": results})
    finally:
        _bob_restore_builtins(patched)
        _bob_sys.settrace(None)

def bob_run(user_src, timeout_seconds):
    buf = _BobLimitedStdout()
    error = None
    _bob_sys.settrace(_bob_time_guard(timeout_seconds))
    try:
        with _bob_redirect_stdout(buf):
            exec(user_src, {"__name__": "__main__"})
    except _BobTimeout as t:
        error = "output_limit" if str(t) == "output_limit" else "timeout"
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
    finally:
        _bob_sys.settrace(None)
    return _bob_json.dumps({"stdout": buf.getvalue(), "error": error})
`;

const GRADE_TIMEOUT_SECONDS = 15;
const RUN_TIMEOUT_SECONDS = 15;

// ==========================================
// WORKER BRIDGE
// ==========================================
// The worker source is inlined as a string (see plugins/worker-inline-
// plugin.ts) and started from a Blob URL. This keeps it self-contained:
// no separate file to serve/copy, and it works identically in dev and
// prod. A Blob worker can't resolve relative URLs, so we pass the
// absolute pyodide/ URL in the init message.
import workerSource from "./pyodide.worker.js";
const workerBlobUrl = URL.createObjectURL(
  new Blob([workerSource], { type: "application/javascript" }),
);

// Force-stopped operations are rejected with this so callers can tell
// them apart from real errors and show a "restarting" message.
export class ForceStopError extends Error {
  constructor() {
    super("Force-stopped — restarting the robot helper.");
    this.name = "ForceStopError";
  }
}

let worker = null;
let onStatus = null;
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject }
let initPromise = null;
let initResolve = null;
let initReject = null;

function createWorker() {
  worker = new Worker(workerBlobUrl);
  worker.onmessage = (e) => {
    const msg = e.data;
    // Status updates have no id — they're fire-and-forget from the worker.
    if (msg.type === "status") {
      if (onStatus) onStatus(msg.state, msg.text);
      return;
    }
    if (msg.type === "done" && initResolve) {
      // init completed
      initResolve();
      return;
    }
    const handler = pending.get(msg.id);
    if (!handler) return;
    pending.delete(msg.id);
    if (msg.type === "result") handler.resolve(msg.value);
    else if (msg.type === "error") handler.reject(new Error(msg.message));
  };
  worker.onerror = (e) => {
    // Fatal worker error: reject the init promise if pending, and all
    // pending requests. The worker is dead.
    if (initReject) initReject(new Error(e.message || "Worker crashed"));
    for (const [, h] of pending) h.reject(new Error("Worker crashed"));
    pending.clear();
    if (onStatus) onStatus("error", "Robot helper crashed");
  };
}

function send(type, payload, { awaitsResult = true } = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    if (awaitsResult) pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...payload });
    if (!awaitsResult) resolve();
  });
}

/**
 * Loads Pyodide (inside the worker) and defines the grading harness.
 * onStatus(state, text): state is "loading" | "ready" | "error".
 */
export async function initBob(statusCb) {
  onStatus = statusCb || null;
  if (initPromise) return initPromise;
  createWorker();
  initPromise = new Promise((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;
  });
  try {
    // pyodide/ sits next to the current page (build.ts copies it into
    // every exercise route). Resolve its absolute URL from the page.
    const pyodideUrl = new URL("pyodide/", location.href).href;
    await send("init", { harness: HARNESS, pyodideUrl });
  } catch (err) {
    initReject(err);
    throw err;
  }
  return initPromise;
}

function testsLiteral(exercise) {
  const items = exercise.tests.map(
    (t) => `(${JSON.stringify(t.func || exercise.funcName)}, (${t.args}), (${t.expected}))`,
  );
  return `[${items.join(", ")}]`;
}

/**
 * Grades `code` against the exercise's test battery.
 * Returns:
 *   { fatal: string }                       — import/syntax/missing function
 *   { results: [{ok, expected, got, error}], passed: bool }
 */
export async function grade(code, exercise) {
  if (!worker) throw new Error("Grader not initialized");

  const globals = {
    __bob_src: code,
    __bob_func: exercise.funcName,
    __bob_tests: testsLiteral(exercise),
    __bob_banned: JSON.stringify(exercise.banned || {}),
    __bob_timeout: GRADE_TIMEOUT_SECONDS,
  };
  const expr =
    "bob_grade(__bob_src, __bob_func, __bob_tests, __bob_banned, __bob_timeout)";
  const out = await send("run", { globals, expr });
  const data = JSON.parse(out);
  if (data.fatal) return data;
  const results = data.results.map((r, i) => ({
    ...r,
    call: exercise.tests[i].call,
  }));
  return { results, passed: results.every((r) => r.ok) };
}

/**
 * Just runs the player's script (no grading), capturing everything it
 * prints. The harness kills it after RUN_TIMEOUT_SECONDS (infinite-loop
 * guard) and caps the captured output.
 * Returns { stdout: string, error: null | "timeout" | "output_limit" | "SomeError: ..." }
 */
export async function runScript(code) {
  if (!worker) throw new Error("Grader not initialized");
  const globals = {
    __bob_run_src: code,
    __bob_run_timeout: RUN_TIMEOUT_SECONDS,
  };
  const out = await send("run", { globals, expr: "bob_run(__bob_run_src, __bob_run_timeout)" });
  return JSON.parse(out);
}

/**
 * Formats `code` with Black (loaded on first use from the local
 * pyodide/ dir). Returns the formatted source, or the original text if
 * nothing changed. Throws if Black can't parse the code.
 */
export async function formatPython(code) {
  if (!worker) throw new Error("Grader not initialized");
  return send("format", { code });
}

/**
 * Kills the current worker and spins up a fresh one. Every pending
 * operation (grade / run / format) is rejected with ForceStopError so
 * the UI can show a "restarting" state. The new worker re-runs initBob
 * automatically; onStatus will flip back through loading -> ready.
 */
export async function forceStop() {
  if (!worker) return;

  // Reject everything in flight as force-stopped.
  for (const [, h] of pending) h.reject(new ForceStopError());
  pending.clear();

  // The init promise (if mid-boot) also dies — reset so re-init works.
  if (initReject) initReject(new ForceStopError());
  initPromise = null;
  initResolve = null;
  initReject = null;

  worker.terminate();
  worker = null;

  // Re-boot a fresh worker.
  if (onStatus) onStatus("loading", "Restarting the robot helper...");
  initPromise = new Promise((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;
  });
  createWorker();
  try {
    const pyodideUrl = new URL("pyodide/", location.href).href;
    await send("init", { harness: HARNESS, pyodideUrl });
  } catch (err) {
    initReject(err);
    throw err;
  }
  return initPromise;
}

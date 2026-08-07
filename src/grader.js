/**
 * grader.js — Bob's little robot helper.
 *
 * Loads Pyodide (from the CDN script tag) and grades the player's code
 * entirely in the browser. Mirrors the trace style of a terminal grader:
 * for each test it reports the call, the expected value, what the player's
 * function returned, and OK/KO.
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

let pyodideInstance = null;

const GRADE_TIMEOUT_SECONDS = 15;
const RUN_TIMEOUT_SECONDS = 15;

/**
 * Loads Pyodide and defines the grading harness.
 * onStatus(state, text): state is "loading" | "ready" | "error".
 */
export async function initBob(onStatus) {
  if (pyodideInstance) return pyodideInstance;

  const setStatus = (s, t) => onStatus && onStatus(s, t);

  setStatus("loading", "Waking up Bob's robot helper...");
  const pyodide = await loadPyodide();

  setStatus("loading", "Teaching the robot how to grade...");
  await pyodide.runPythonAsync(HARNESS);

  pyodideInstance = pyodide;
  setStatus("ready", "Robot helper ready");
  return pyodide;
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
  const pyodide = pyodideInstance;
  if (!pyodide) throw new Error("Grader not initialized");

  pyodide.globals.set("__bob_src", code);
  pyodide.globals.set("__bob_func", exercise.funcName);
  pyodide.globals.set("__bob_tests", testsLiteral(exercise));
  pyodide.globals.set(
    "__bob_banned",
    JSON.stringify(exercise.banned || {}),
  );
  pyodide.globals.set("__bob_timeout", GRADE_TIMEOUT_SECONDS);

  const out = await pyodide.runPythonAsync(
    "bob_grade(__bob_src, __bob_func, __bob_tests, __bob_banned, __bob_timeout)",
  );
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
  const pyodide = pyodideInstance;
  if (!pyodide) throw new Error("Grader not initialized");

  pyodide.globals.set("__bob_run_src", code);
  pyodide.globals.set("__bob_run_timeout", RUN_TIMEOUT_SECONDS);
  const out = await pyodide.runPythonAsync(
    "bob_run(__bob_run_src, __bob_run_timeout)",
  );
  return JSON.parse(out);
}
// ==========================================
// BLACK FORMATTER (via micropip, lazy-loaded)
// ==========================================
let blackPromise = null;

async function ensureBlack(pyodide) {
  if (!blackPromise) {
    blackPromise = (async () => {
      await pyodide.loadPackage("micropip");
      await pyodide.runPythonAsync(
        "import micropip\nawait micropip.install('black')",
      );
    })();
    // If the download/install fails, allow a retry on the next click
    blackPromise.catch(() => {
      blackPromise = null;
    });
  }
  return blackPromise;
}

/**
 * Formats `code` with Black (installed on first use via micropip).
 * Returns the formatted source, or the original text if nothing changed.
 * Throws if Black can't parse the code or fails to install.
 */
export async function formatPython(code) {
  const pyodide = pyodideInstance;
  if (!pyodide) throw new Error("Grader not initialized");

  await ensureBlack(pyodide);
  pyodide.globals.set("__bob_fmt_src", code);
  return pyodide.runPythonAsync(`
import black as _bob_black

def _bob_black_format(src):
    try:
        return _bob_black.format_str(src, mode=_bob_black.Mode())
    except _bob_black.report.NothingChanged:
        return src

_bob_black_format(__bob_fmt_src)
`);
}

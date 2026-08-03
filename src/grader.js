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

def bob_grade(user_src, func_name, tests_literal, timeout_seconds=15):
    ns = {}
    _bob_sys.settrace(_bob_time_guard(timeout_seconds))
    try:
        exec(user_src, ns)
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
  pyodide.globals.set("__bob_timeout", GRADE_TIMEOUT_SECONDS);

  const out = await pyodide.runPythonAsync(
    "bob_grade(__bob_src, __bob_func, __bob_tests, __bob_timeout)",
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

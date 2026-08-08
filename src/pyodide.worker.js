/**
 * pyodide.worker.js — classic Web Worker that owns the Pyodide runtime.
 *
 * Runs Pyodide off the main thread so the UI never freezes (not during
 * loading, not during grading, not during an infinite loop in player
 * code). The main thread can kill this worker at any time via
 * forceStop() in grader.js, which terminates it and spins up a fresh
 * one — the only reliable way to break out of a runaway Python loop.
 *
 * Classic worker (not module) on purpose: importScripts() lets us load
 * the local pyodide.js without involving the bundler.
 */

let pyodide = null;
let pyodidePromise = null;
let blackReady = false;
// Absolute URL of the local pyodide/ dir, sent from the main thread
// (a Blob worker can't resolve relative paths against its own location).
let pyodideUrl = null;

function postStatus(state, text) {
  self.postMessage({ type: "status", state, text });
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    importScripts(pyodideUrl + "pyodide.js");
    pyodide = await loadPyodide({ indexURL: pyodideUrl });
    return pyodide;
  })();
  return pyodidePromise;
}

self.onmessage = async (e) => {
  const msg = e.data;
  const id = msg.id;
  const type = msg.type;

  try {
    if (type === "init") {
      pyodideUrl = msg.pyodideUrl;
      postStatus("loading", "Waking up Bob's robot helper...");
      const py = await ensurePyodide();
      postStatus("loading", "Teaching the robot how to grade...");
      await py.runPythonAsync(msg.harness);
      postStatus("ready", "Robot helper ready");
      self.postMessage({ id, type: "done" });
      return;
    }

    if (type === "run") {
      const py = await ensurePyodide();
      const globals = msg.globals || {};
      for (const [k, v] of Object.entries(globals)) {
        py.globals.set(k, v);
      }
      const result = await py.runPythonAsync(msg.expr);
      // runPythonAsync returns a PyProxy for Python objects; the harness
      // functions return json strings / plain str, so a toString() is
      // enough and avoids leaking a proxy across the thread boundary.
      const value =
        result && typeof result.toString === "function" && typeof result !== "string"
          ? result.toString()
          : result;
      if (value && typeof value.destroy === "function") {
        try {
          value.destroy();
        } catch (_) {}
      }
      self.postMessage({ id, type: "result", value });
      return;
    }

    if (type === "format") {
      const py = await ensurePyodide();
      if (!blackReady) {
        postStatus("loading", "Loading the formatter...");
        // Black + deps are registered in pyodide-lock.json, so this
        // loads entirely from the local pyodide/ dir (no CDN/PyPI).
        await py.loadPackage("black");
        blackReady = true;
      }
      py.globals.set("__bob_fmt_src", msg.code);
      const formatted = await py.runPythonAsync(`
import black as _bob_black

def _bob_black_format(src):
    try:
        return _bob_black.format_str(src, mode=_bob_black.Mode())
    except _bob_black.report.NothingChanged:
        return src

_bob_black_format(__bob_fmt_src)
`);
      const out =
        formatted && typeof formatted !== "string"
          ? formatted.toString()
          : formatted;
      if (out && typeof out.destroy === "function") {
        try {
          out.destroy();
        } catch (_) {}
      }
      self.postMessage({ id, type: "result", value: out });
      return;
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      message: String(err && err.message ? err.message : err),
    });
  }
};

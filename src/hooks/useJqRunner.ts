/**
 * @fileoverview React hook for running jq expressions via jq-web WASM.
 *
 * Manages loading/result state and prevents race conditions when the
 * user triggers multiple runs in quick succession.
 */

import { useCallback, useRef, useState } from 'react';

import { type JqResult, preloadJq } from '../utils/jq-loader';
import { runJqViaWorker } from '../utils/jq-worker-client';

export function useJqRunner() {
  const [result, setResult] = useState<JqResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const runIdRef = useRef(0);

  const run = useCallback(async (expression: string, jsonInput: string) => {
    const currentRunId = ++runIdRef.current;
    setIsRunning(true);

    // Off the main thread when the host serves the worker file, so a runaway
    // expression is stopped at the Test deadline instead of freezing the tab;
    // transparently falls back to synchronous evaluation otherwise.
    const res = await runJqViaWorker(expression, jsonInput);

    // Ignore stale results from previous runs
    if (currentRunId === runIdRef.current) {
      setResult(res);
      setIsRunning(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setIsRunning(false);
  }, []);

  // Surface an error the run never reached — e.g. a host sample provider that
  // threw — through the same failed-result path a jq error takes, and invalidate
  // any in-flight run so its late result cannot overwrite this one.
  const fail = useCallback((error: string) => {
    runIdRef.current++;
    setResult({ success: false, output: '', error, durationMs: 0 });
    setIsRunning(false);
  }, []);

  return { result, isRunning, run, fail, clear, preload: preloadJq };
}

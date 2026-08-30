/**
 * @fileoverview React hook for running jq expressions via jq-web WASM.
 *
 * Manages loading/result state and prevents race conditions when the
 * user triggers multiple runs in quick succession.
 */

import { useState, useRef, useCallback } from 'react';
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

  return { result, isRunning, run, clear, preload: preloadJq };
}

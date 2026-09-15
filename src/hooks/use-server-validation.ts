/**
 * Drives an optional host `serverValidate` hook for the Test panel: parses the
 * sample JSON, calls the hook, and tracks the pending / result state. A parse
 * failure or a rejected hook surfaces as a failed verdict, never a silent drop.
 */
import { useCallback, useState } from 'react';

import type { ServerValidateHook, ServerValidationResult } from '../declaration';

export interface ServerValidationState {
  serverResult: ServerValidationResult | null;
  serverPending: boolean;
  validate: () => void;
  reset: () => void;
}

export const useServerValidation = (
  serverValidate: ServerValidateHook | undefined,
  expression: string,
  jsonInput: string,
): ServerValidationState => {
  const [serverResult, setServerResult] = useState<ServerValidationResult | null>(null);
  const [serverPending, setServerPending] = useState(false);

  const validate = useCallback(() => {
    if (!serverValidate) return;
    let parsed: unknown = undefined;
    try {
      parsed = jsonInput.trim() ? JSON.parse(jsonInput) : undefined;
    } catch {
      setServerResult({ ok: false, message: 'Sample input is not valid JSON.' });
      return;
    }
    setServerPending(true);
    setServerResult(null);
    void serverValidate({ expression, sampleInput: parsed })
      .then((res) => {
        setServerResult(res);
      })
      .catch((err: unknown) => {
        setServerResult({
          ok: false,
          message: err instanceof Error ? err.message : 'Validation failed.',
        });
      })
      .finally(() => {
        setServerPending(false);
      });
  }, [serverValidate, expression, jsonInput]);

  const reset = useCallback(() => {
    setServerResult(null);
  }, []);

  return { serverResult, serverPending, validate, reset };
};

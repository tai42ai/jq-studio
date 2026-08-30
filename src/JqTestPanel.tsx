/**
 * Runs the generated jq expression against sample JSON. A floating "Test"
 * button opens a dialog with a read-only expression view, a JSON input, a Run
 * action (also Cmd/Ctrl+Enter), and a colour-coded output.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Play,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Button, Dialog, Textarea, Tooltip } from './primitives';
import clsx from 'clsx';
import type { ValidationErrorMap } from './utils/flow-validator';
import type { ServerValidateHook, ServerValidationResult } from './declaration';
import { useJqRunner } from './hooks/useJqRunner';

/** The primitives `Dialog` portals its content to `document.body`, outside this
 *  library's `.jq-studio-root` scope. Hanging the root class on the content
 *  element (via `contentClassName`) re-enters the scope so the panel's scoped
 *  `jqs-jq-*` styles — the spread label rows, the muted shape annotation, the
 *  keyboard-hint chip — actually apply inside the portal. Without it every scoped
 *  rule is dropped and the labels collapse into unstyled run-on text. */
const EDITOR_ROOT_CLASS = 'jq-studio-root';

interface JqTestPanelProps {
  expression: string;
  validationErrors: ValidationErrorMap;
  /** Static skeleton JSON (from the field's input-shape descriptor) the input is
   *  seeded with when the panel opens — an editable, replaceable default. */
  sampleInput?: string;
  /** The `.` shape label, used in the input placeholder ("node envelope" …). */
  shapeLabel?: string;
  /** What the expression must return, shown under the output ("an object" …). */
  returns?: string;
  /** Pluggable server validator: when a host provides one, the panel surfaces a
   *  "Validate on server" action and its verdict — a consumer's `serverValidate`. */
  serverValidate?: ServerValidateHook;
}

export const JqTestPanel = ({
  expression,
  validationErrors,
  sampleInput,
  shapeLabel,
  returns,
  serverValidate,
}: JqTestPanelProps) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverResult, setServerResult] = useState<ServerValidationResult | null>(null);
  const [serverPending, setServerPending] = useState(false);
  const { result, isRunning, run, clear, preload } = useJqRunner();

  const hasErrors = useMemo(() => {
    for (const errors of validationErrors.values()) {
      if (errors.some((e) => e.severity === 'error')) return true;
    }
    return false;
  }, [validationErrors]);

  const isExpressionError = expression.startsWith('# Error:');
  const isDisabled = hasErrors || isExpressionError || !expression;

  useEffect(() => {
    if (open) preload();
  }, [open, preload]);

  // Seed the input with the field's sample skeleton on open (only when the box is
  // empty, so a user's own paste is never clobbered). Closing clears transient
  // run/validation state.
  useEffect(() => {
    if (open && sampleInput !== undefined) {
      setJsonInput((current) => (current.trim() === '' ? sampleInput : current));
    }
  }, [open, sampleInput]);

  useEffect(() => {
    if (!open) {
      clear();
      setServerResult(null);
    }
  }, [open, clear]);

  const handleRun = useCallback(() => {
    if (!jsonInput.trim() || isRunning) return;
    void run(expression, jsonInput);
  }, [expression, jsonInput, isRunning, run]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleRun]);

  const handleServerValidate = useCallback(() => {
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

  const handleCopyExpression = useCallback(() => {
    void navigator.clipboard.writeText(expression);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [expression]);

  const tooltipMessage = hasErrors
    ? 'Fix validation errors to test'
    : isExpressionError
      ? 'Fix flow errors to test'
      : !expression
        ? 'Build a flow to test'
        : 'Test expression';

  return (
    <>
      <Tooltip content={<span className="jq-studio-root jqs-jq-tooltip">{tooltipMessage}</span>}>
        <span className="jqs-jq-float-btn-wrap">
          <Button
            disabled={isDisabled}
            onClick={() => {
              setOpen(true);
            }}
          >
            <FlaskConical className="jqs-jq-icon" />
            Test
          </Button>
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Test Expression"
        description="Run your jq expression against sample JSON data"
        contentClassName={EDITOR_ROOT_CLASS}
      >
        <div className="jqs-jq-dialog-body">
          <div className="jqs-jq-field">
            <div className="jqs-jq-field__label-row jqs-jq-field__label-row--spread">
              <span className="jqs-jq-label">Expression</span>
              <button type="button" className="jqs-jq-text-btn" onClick={handleCopyExpression}>
                {copied ? (
                  <Check className="jqs-jq-icon-sm" />
                ) : (
                  <Copy className="jqs-jq-icon-sm" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="jqs-jq-code">{expression}</pre>
          </div>

          <div className="jqs-jq-field">
            <div className="jqs-jq-field__label-row jqs-jq-field__label-row--spread">
              <span className="jqs-jq-label">JSON Input</span>
              {shapeLabel && <span className="jqs-jq-muted">as: {shapeLabel}</span>}
            </div>
            <Textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
              }}
              placeholder={
                shapeLabel
                  ? `Sample ${shapeLabel} JSON — replace with your own`
                  : '{\n  "example": "paste your JSON here"\n}'
              }
              spellCheck={false}
              rows={6}
              style={{ fontFamily: 'var(--jq-font-mono)', resize: 'vertical' }}
            />
          </div>

          <div className="jqs-jq-run-row">
            <Button variant="primary" onClick={handleRun} disabled={!jsonInput.trim() || isRunning}>
              {isRunning ? (
                <Loader2 className="jqs-jq-icon jqs-jq-spin" />
              ) : (
                <Play className="jqs-jq-icon" />
              )}
              {isRunning ? 'Running...' : 'Run'}
            </Button>
            <kbd className="jqs-jq-kbd">
              {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
            </kbd>
            {serverValidate && (
              <Button onClick={handleServerValidate} disabled={serverPending || !expression}>
                {serverPending ? (
                  <Loader2 className="jqs-jq-icon jqs-jq-spin" />
                ) : (
                  <ShieldCheck className="jqs-jq-icon" />
                )}
                Validate
              </Button>
            )}
            {result && <span className="jqs-jq-duration">{result.durationMs.toFixed(1)}ms</span>}
          </div>

          {result && (
            <div className="jqs-jq-field">
              <div className="jqs-jq-field__label-row">
                {result.success ? (
                  <CheckCircle2 className="jqs-jq-icon-sm jqs-jq-ok" />
                ) : (
                  <AlertCircle className="jqs-jq-icon-sm jqs-jq-err" />
                )}
                <span className="jqs-jq-label">
                  {result.success ? 'Output' : result.timedOut ? 'Timed out' : 'Error'}
                </span>
                {returns && <span className="jqs-jq-muted">must return {returns}</span>}
              </div>
              <pre
                className={clsx(
                  'jqs-jq-output',
                  result.success ? 'jqs-jq-output--ok' : 'jqs-jq-output--err',
                )}
              >
                {result.success ? result.output : result.error}
              </pre>
            </div>
          )}

          {serverResult && (
            <div className="jqs-jq-field">
              <div className="jqs-jq-field__label-row">
                {serverResult.ok ? (
                  <CheckCircle2 className="jqs-jq-icon-sm jqs-jq-ok" />
                ) : (
                  <AlertCircle className="jqs-jq-icon-sm jqs-jq-err" />
                )}
                <span className="jqs-jq-label">
                  {serverResult.ok ? 'Valid on server' : 'Server validation failed'}
                </span>
              </div>
              {serverResult.message && (
                <pre
                  className={clsx(
                    'jqs-jq-output',
                    serverResult.ok ? 'jqs-jq-output--ok' : 'jqs-jq-output--err',
                  )}
                >
                  {serverResult.message}
                </pre>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
};

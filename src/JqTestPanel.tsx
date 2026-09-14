/**
 * Runs the generated jq expression against sample JSON. A floating "Test"
 * button opens a dialog with a read-only expression view, a JSON input, a Run
 * action (also Cmd/Ctrl+Enter), and a colour-coded output.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { FlaskConical, Play, Copy, Check, Loader2, ShieldCheck } from 'lucide-react';
import { Button, Dialog, Textarea, Tooltip } from './primitives';
import type { ValidationErrorMap } from './utils/flow-validator';
import type { ServerValidateHook } from './declaration';
import { useJqRunner } from './hooks/useJqRunner';
import { useServerValidation } from './hooks/use-server-validation';
import { TestRunResult } from './components/TestRunResult';
import { ServerValidationResult } from './components/ServerValidationResult';

/** The primitives `Dialog` portals its content to `document.body`, outside this
 *  library's `.jq-studio-root` scope. Hanging the root class on the content
 *  element (via `contentClassName`) re-enters the scope so the panel's scoped
 *  `jqs-jq-*` styles — the spread label rows, the muted shape annotation, the
 *  keyboard-hint chip — actually apply inside the portal. Without it every scoped
 *  rule is dropped and the labels collapse into unstyled run-on text. */
const EDITOR_ROOT_CLASS = 'jq-studio-root';

interface TestPanelBodyProps {
  expression: string;
  copied: boolean;
  onCopy: () => void;
  jsonInput: string;
  onJsonInput: (value: string) => void;
  shapeLabel?: string;
  returns?: string;
  onRun: () => void;
  isRunning: boolean;
  serverValidate?: ServerValidateHook;
  onValidate: () => void;
  serverPending: boolean;
  result: ReturnType<typeof useJqRunner>['result'];
  serverResult: ReturnType<typeof useServerValidation>['serverResult'];
}

/** The dialog contents: the read-only expression readout with a copy control, the
 *  editable JSON input, the Run / Validate actions, and the two result blocks. */
const TestPanelBody = ({
  expression,
  copied,
  onCopy,
  jsonInput,
  onJsonInput,
  shapeLabel,
  returns,
  onRun,
  isRunning,
  serverValidate,
  onValidate,
  serverPending,
  result,
  serverResult,
}: TestPanelBodyProps) => (
  <div className="jqs-jq-dialog-body">
    <div className="jqs-jq-field">
      <div className="jqs-jq-field__label-row jqs-jq-field__label-row--spread">
        <span className="jqs-jq-label">Expression</span>
        <button type="button" className="jqs-jq-text-btn" onClick={onCopy}>
          {copied ? <Check className="jqs-jq-icon-sm" /> : <Copy className="jqs-jq-icon-sm" />}
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
          onJsonInput(e.target.value);
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
      <Button variant="primary" onClick={onRun} disabled={!jsonInput.trim() || isRunning}>
        {isRunning ? (
          <Loader2 className="jqs-jq-icon jqs-jq-spin" />
        ) : (
          <Play className="jqs-jq-icon" />
        )}
        {isRunning ? 'Running...' : 'Run'}
      </Button>
      <kbd className="jqs-jq-kbd">{navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Enter</kbd>
      {serverValidate && (
        <Button onClick={onValidate} disabled={serverPending || !expression}>
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

    {result && <TestRunResult result={result} returns={returns} />}
    {serverResult && <ServerValidationResult result={serverResult} />}
  </div>
);

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
  const { result, isRunning, run, clear, preload } = useJqRunner();
  const { serverResult, serverPending, validate, reset } = useServerValidation(
    serverValidate,
    expression,
    jsonInput,
  );

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
      reset();
    }
  }, [open, clear, reset]);

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
        <TestPanelBody
          expression={expression}
          copied={copied}
          onCopy={handleCopyExpression}
          jsonInput={jsonInput}
          onJsonInput={setJsonInput}
          shapeLabel={shapeLabel}
          returns={returns}
          onRun={handleRun}
          isRunning={isRunning}
          serverValidate={serverValidate}
          onValidate={validate}
          serverPending={serverPending}
          result={result}
          serverResult={serverResult}
        />
      </Dialog>
    </>
  );
};

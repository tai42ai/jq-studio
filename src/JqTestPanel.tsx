/**
 * Runs the generated jq expression against sample JSON. A floating "Test"
 * button opens a dialog with a read-only expression view, a JSON input, a Run
 * action (also Cmd/Ctrl+Enter), and a colour-coded output.
 */
import { Check, Copy, FlaskConical, Loader2, Play, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ServerValidationResult } from './components/ServerValidationResult';
import { TestRunResult } from './components/TestRunResult';
import type { ServerValidateHook } from './declaration';
import { useServerValidation } from './hooks/use-server-validation';
import { useJqRunner } from './hooks/useJqRunner';
import { Button, Dialog, Textarea, Tooltip } from './primitives';
import type { ValidationErrorMap } from './utils/flow-validator';
import { bindJqVariables } from './utils/jq-variable-binding';

/** The primitives `Dialog` portals its content to `document.body`, outside this
 *  library's `.jq-studio-root` scope. Hanging the root class on the content
 *  element (via `contentClassName`) re-enters the scope so the panel's scoped
 *  `jqs-jq-*` styles — the spread label rows, the muted shape annotation, the
 *  keyboard-hint chip — actually apply inside the portal. Without it every scoped
 *  rule is dropped and the labels collapse into unstyled run-on text. */
const EDITOR_ROOT_CLASS = 'jq-studio-root';

/** One declared variable shown in the Test panel's read-only Variables section:
 *  its `$name`, blurb, and the sample value the run binds it to. */
interface TestPanelVariable {
  readonly name: string;
  readonly blurb: string;
}

interface TestPanelBodyProps {
  expression: string;
  copied: boolean;
  onCopy: () => void;
  jsonInput: string;
  onJsonInput: (value: string) => void;
  shapeLabel?: string;
  returns?: string;
  variables?: readonly TestPanelVariable[];
  sampleVariables?: Record<string, unknown>;
  onRun: () => void;
  isRunning: boolean;
  runDisabled: boolean;
  serverValidate?: ServerValidateHook;
  onValidate: () => void;
  serverPending: boolean;
  result: ReturnType<typeof useJqRunner>['result'];
  serverResult: ReturnType<typeof useServerValidation>['serverResult'];
}

/** The read-only Variables section: one row per declared variable — its `$name`
 *  code token, its blurb, and the sample JSON the run binds it to (from
 *  `sampleVariables`). Static content, so it adds no focus stops. */
const TestPanelVariables = ({
  variables,
  sampleVariables,
}: {
  variables?: readonly TestPanelVariable[];
  sampleVariables?: Record<string, unknown>;
}) => {
  if (!variables || variables.length === 0) return null;
  return (
    <div className="jqs-jq-field">
      <div className="jqs-jq-field__label-row jqs-jq-field__label-row--spread">
        <span className="jqs-jq-label">Variables</span>
        <span className="jqs-jq-muted">Bound on Run from the field&rsquo;s declaration.</span>
      </div>
      <div className="jqs-jq-test-vars">
        {variables.map((variable) => (
          <div key={variable.name} className="jqs-jq-test-var">
            <div className="jqs-jq-test-var__head">
              <code className="jqs-jq-test-var__name">${variable.name}</code>
              <span className="jqs-jq-muted">{variable.blurb}</span>
            </div>
            <pre className="jqs-jq-code jqs-jq-test-var__sample">
              {JSON.stringify(sampleVariables?.[variable.name] ?? null, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

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
  variables,
  sampleVariables,
  onRun,
  isRunning,
  runDisabled,
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

    <TestPanelVariables variables={variables} sampleVariables={sampleVariables} />

    <div className="jqs-jq-run-row">
      <Button variant="primary" onClick={onRun} disabled={runDisabled}>
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
  /** The sample VALUES bound as `$name` for the run, keyed by variable name — the
   *  field's declared variables resolved to their samples. The run binds these for
   *  evaluation; the server validator receives them too. Empty when the field
   *  declares no variables. */
  sampleVariables?: Record<string, unknown>;
  /** The declared variables (name + blurb, in declared order) the panel lists in a
   *  read-only Variables section, each shown with the sample from `sampleVariables`
   *  the run binds. Absent/empty = no section. */
  variables?: readonly TestPanelVariable[];
  /** The `.` shape label, used in the input placeholder ("node envelope" …). */
  shapeLabel?: string;
  /** What the expression must return, shown under the output ("an object" …). */
  returns?: string;
  /** A message from building the run's input that failed before any jq ran — e.g.
   *  a host sample provider that threw. When set, the panel shows it in the result
   *  area and the run is blocked, rather than binding a silent fallback. */
  sampleError?: string;
  /** Pluggable server validator: when a host provides one, the panel surfaces a
   *  "Validate on server" action and its verdict — a consumer's `serverValidate`. */
  serverValidate?: ServerValidateHook;
}

export const JqTestPanel = ({
  expression,
  validationErrors,
  sampleInput,
  sampleVariables,
  variables,
  shapeLabel,
  returns,
  sampleError,
  serverValidate,
}: JqTestPanelProps) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const { result, isRunning, run, fail, clear, preload } = useJqRunner();
  const { serverResult, serverPending, validate, reset } = useServerValidation(
    serverValidate,
    expression,
    jsonInput,
    sampleVariables,
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

  // A host sample provider that threw is shown at once when the panel opens — the
  // same failed-result surface a jq error uses — so the failure is visible and
  // the run stays blocked rather than binding a silent fallback.
  useEffect(() => {
    if (open && sampleError !== undefined) fail(sampleError);
  }, [open, sampleError, fail]);

  const handleRun = useCallback(() => {
    if (!jsonInput.trim() || isRunning) return;
    // A provider failure cannot be run over — surface it instead of binding a
    // silent fallback.
    if (sampleError !== undefined) {
      fail(sampleError);
      return;
    }
    // Bind the declared variables as `$name` for the run, so `.` carries only the
    // data the user edits and every `$name` is reachable across the expression.
    const { program, input } = bindJqVariables(expression, jsonInput, sampleVariables ?? {});
    void run(program, input);
  }, [expression, jsonInput, sampleVariables, sampleError, isRunning, run, fail]);

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

  // Nothing to run without input, mid-run, or when building the run's input
  // itself failed (a throwing sample provider).
  const runDisabled = !jsonInput.trim() || isRunning || sampleError !== undefined;

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
          variables={variables}
          sampleVariables={sampleVariables}
          onRun={handleRun}
          isRunning={isRunning}
          runDisabled={runDisabled}
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

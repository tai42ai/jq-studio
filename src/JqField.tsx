/**
 * `JqField` — the drop-in jq expression field. A labelled text control plus a
 * "Visual editor" button that opens the full {@link JqEditorDialog}; on save the
 * new expression flows back through `onChange`. Everything a host needs is wired
 * by default: the jq WASM runtime loads lazily, the evaluation worker installs
 * itself on mount, and the built-in primitives render the chrome (a host can swap
 * them through `PrimitivesProvider`).
 *
 * ```tsx
 * <JqField label="Transform" value={expr} onChange={setExpr} />
 * ```
 *
 * `shape` describes what `.` is for this field (drives the editor's context chip
 * and the Test panel's seeded sample); `sampleInput` supplies a live sample that
 * takes precedence over `shape.sample` when seeding Test; `serverValidate` plugs a
 * host validator into the Test panel; `multiline` renders a textarea instead of a
 * single-line input for the resting control. `description` and `error` render
 * a11y-linked helper slots under the control (wired via `aria-describedby`, with
 * `aria-invalid` set while an error is present).
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';

import { Button, TextInput, Textarea } from './primitives';
import { JQEditorDialog } from './JQEditorDialog';
import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  ServerValidateHook,
} from './declaration';
import { installDefaultJqWorker } from './utils/install-default-worker';

export interface JqFieldProps {
  /** The field's visible label, also shown as the editor dialog's title. */
  readonly label: string;
  /** The current jq expression (controlled). */
  readonly value: string;
  /** Called with the new expression when the user edits the field or saves the
   *  visual editor. */
  readonly onChange: (value: string) => void;
  /** What `.` IS for this field — drives the editor's context chip and the Test
   *  panel's seeded sample. */
  readonly shape?: JqInputShapeDescriptor;
  /** A live sample-input provider for the Test panel. Takes precedence over the
   *  static `shape.sample` skeleton when it yields a defined value — the
   *  declaration's dynamic-sample contract, so a host can seed Test with a real
   *  document instead of the static skeleton. Invoked on every editor open (not
   *  lazily at Test-panel open), so keep it side-effect free.
   *  See {@link SampleInputProvider}. */
  readonly sampleInput?: SampleInputProvider;
  /** A pluggable server-validate hook surfaced in the editor's Test panel. */
  readonly serverValidate?: ServerValidateHook;
  /** Render a textarea instead of a single-line input for the resting control. */
  readonly multiline?: boolean;
  /** Show the expression read-only (the visual editor opens as a viewer). */
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  /** An id for the resting control, so a host `<label htmlFor>` can point at it. */
  readonly id?: string;
  /** Helper text rendered under the control and wired to it via `aria-describedby`
   *  — the a11y-linked slot a host would otherwise have to fake with an
   *  unassociated sibling `<p>`. */
  readonly description?: ReactNode;
  /** Error text rendered under the control (danger token, `role="alert"`) and
   *  wired to the control via `aria-describedby`; its presence also sets
   *  `aria-invalid` on the control. */
  readonly error?: ReactNode;
}

export function JqField({
  label,
  value,
  onChange,
  shape,
  sampleInput,
  serverValidate,
  multiline = false,
  readOnly = false,
  placeholder,
  id,
  description,
  error,
}: JqFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);

  // Only reference the ids that are actually rendered, so `aria-describedby`
  // never dangles at an absent node (a dangling id is worse than none). The
  // control lists both when both slots are present; `aria-invalid` mirrors the
  // presence of an error.
  const descriptionId = description != null ? `${controlId}-description` : undefined;
  const errorId = error != null ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const invalid = error != null ? true : undefined;

  // Install the default worker once, so a runaway expression the Test panel runs
  // is terminated on a deadline rather than freezing the tab.
  useEffect(() => {
    installDefaultJqWorker();
  }, []);

  const resting = multiline ? (
    <Textarea
      id={controlId}
      className="jqs-field__control"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      readOnly={readOnly}
      placeholder={placeholder}
      spellCheck={false}
      rows={3}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  ) : (
    <TextInput
      id={controlId}
      className="jqs-field__control"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      readOnly={readOnly}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  );

  return (
    <div className="jq-studio-root jqs-field">
      <label htmlFor={controlId} className="jqs-field__label">
        {label}
      </label>
      <div className="jqs-field__row">
        {resting}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Pencil className="jqs-icon" aria-hidden />
          {readOnly ? 'Visual view' : 'Visual editor'}
        </Button>
      </div>
      {description != null && (
        <p id={descriptionId} className="jqs-field__description">
          {description}
        </p>
      )}
      {error != null && (
        <p id={errorId} className="jqs-field__error" role="alert">
          {error}
        </p>
      )}
      <JQEditorDialog
        open={open}
        initialExpression={value}
        fieldLabel={label}
        shape={shape}
        sampleInput={sampleInput}
        serverValidate={serverValidate}
        readOnly={readOnly}
        onSave={(expression) => {
          onChange(expression);
          setOpen(false);
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
    </div>
  );
}

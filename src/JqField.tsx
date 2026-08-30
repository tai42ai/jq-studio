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
 * and the Test panel's seeded sample); `serverValidate` plugs a host validator
 * into the Test panel; `multiline` renders a textarea instead of a single-line
 * input for the resting control.
 */
import { useEffect, useId, useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button, TextInput, Textarea } from './primitives';
import { JQEditorDialog } from './JQEditorDialog';
import type { JqInputShapeDescriptor, ServerValidateHook } from './declaration';
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
  /** A pluggable server-validate hook surfaced in the editor's Test panel. */
  readonly serverValidate?: ServerValidateHook;
  /** Render a textarea instead of a single-line input for the resting control. */
  readonly multiline?: boolean;
  /** Show the expression read-only (the visual editor opens as a viewer). */
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  /** An id for the resting control, so a host `<label htmlFor>` can point at it. */
  readonly id?: string;
}

export function JqField({
  label,
  value,
  onChange,
  shape,
  serverValidate,
  multiline = false,
  readOnly = false,
  placeholder,
  id,
}: JqFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);

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
      <JQEditorDialog
        open={open}
        initialExpression={value}
        fieldLabel={label}
        shape={shape}
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

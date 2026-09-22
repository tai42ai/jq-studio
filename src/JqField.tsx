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
import { Pencil } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { JqRestingControl } from './components/JqRestingControl';
import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  SampleVariablesProvider,
  ServerValidateHook,
} from './declaration';
import { useEditorOpenNotifier } from './hooks/use-editor-open-notifier';
import { JQEditorDialog } from './JQEditorDialog';
import { Button } from './primitives';
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
  /** A live sample-variables provider for the editor's Test panel. Its entries
   *  take precedence over each declared variable's static `sample` when binding
   *  the run's `$name`s. See {@link SampleVariablesProvider}. */
  readonly sampleVariables?: SampleVariablesProvider;
  /** A pluggable server-validate hook surfaced in the editor's Test panel. */
  readonly serverValidate?: ServerValidateHook;
  /** Render a textarea instead of a single-line input for the resting control. */
  readonly multiline?: boolean;
  /** Density variant for dense host rows (the density variant every design system
   *  ships): the visible label is rendered visually-hidden — its accessible name
   *  and `<label htmlFor>` association are preserved, so screen readers and label
   *  clicks still work — and the door button collapses to icon-only (the Pencil),
   *  keeping its full per-field aria-label. The field's vertical rhythm tightens;
   *  the `description` and `error` slots still render if provided. */
  readonly compact?: boolean;
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
  /** Notified on every transition of the visual editor's open state: `true` when
   *  the door button opens it, `false` on EVERY close route — Save, Cancel,
   *  Escape, overlay click, the discard-confirm, and the non-destructive
   *  parse-failure fallback's own Close (all of which funnel through the single
   *  `open` state this fires from, so no route can slip past it).
   *
   *  WHY a host wants this: a host with GLOBAL keyboard shortcuts (window-level
   *  `keydown` listeners for undo/redo/save/delete) must mute them while the
   *  editor is open, because a `keydown` bubbles all the way to `window` even
   *  from the editor's focus-trapped modal — so the host would otherwise fire its
   *  own shortcut on a keystroke the user meant for the editor. Unmounting the
   *  field while the editor is open also counts as a close (fires `false`), so a
   *  host route-swap or crash boundary never strands the shortcuts muted.
   *  Optional; a host with no such shortcuts can ignore it. */
  readonly onEditorOpenChange?: (open: boolean) => void;
}

/** The a11y wiring for the resting control: the description/error slot ids, the
 *  `aria-describedby` listing only the ids actually rendered (a dangling id is
 *  worse than none), and `aria-invalid` mirroring an error's presence. */
const ariaWiring = (controlId: string, description?: ReactNode, error?: ReactNode) => {
  const descriptionId = description != null ? `${controlId}-description` : undefined;
  const errorId = error != null ? `${controlId}-error` : undefined;
  return {
    descriptionId,
    errorId,
    describedBy: [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
    invalid: error != null ? (true as const) : undefined,
  };
};

export function JqField({
  label,
  value,
  onChange,
  shape,
  sampleInput,
  sampleVariables,
  serverValidate,
  multiline = false,
  compact = false,
  readOnly = false,
  placeholder,
  id,
  description,
  error,
  onEditorOpenChange,
}: JqFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);

  useEditorOpenNotifier(open, onEditorOpenChange);

  const { descriptionId, errorId, describedBy, invalid } = ariaWiring(
    controlId,
    description,
    error,
  );

  // Install the default worker once, so a runaway expression the Test panel runs
  // is terminated on a deadline rather than freezing the tab.
  useEffect(() => {
    installDefaultJqWorker();
  }, []);

  const resting = (
    <JqRestingControl
      id={controlId}
      value={value}
      onChange={onChange}
      multiline={multiline}
      readOnly={readOnly}
      placeholder={placeholder}
      describedBy={describedBy}
      invalid={invalid}
    />
  );

  return (
    <div className={`jq-studio-root jqs-field${compact ? ' jqs-field--compact' : ''}`}>
      {/* Compact keeps the <label htmlFor> in the DOM (accessible name + label-click
          association preserved) and only hides it visually. */}
      <label
        htmlFor={controlId}
        className={`jqs-field__label${compact ? ' jqs-visually-hidden' : ''}`}
      >
        {label}
      </label>
      <div className="jqs-field__row">
        {resting}
        {/* The accessible name folds the field label in so multiple JqFields on one
            page expose discernible door names (visible text stays the short verb). */}
        <Button
          type="button"
          variant="secondary"
          aria-label={`${readOnly ? 'Open the visual view' : 'Open the visual editor'} for ${label}`}
          onClick={() => {
            setOpen(true);
          }}
        >
          <Pencil className="jqs-icon" aria-hidden />
          {/* Compact collapses the door to icon-only; the full aria-label above still
              names it, so a screen reader loses nothing. */}
          {compact ? null : readOnly ? 'Visual view' : 'Visual editor'}
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
        sampleVariables={sampleVariables}
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

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
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
  onEditorOpenChange,
}: JqFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);

  // Notify a host on every open-state transition. Keying an effect on the single
  // `open` state — the one place EVERY open/close route mutates (the door button,
  // Save, Cancel, Escape, the overlay, the discard-confirm, and the parse-failure
  // fallback's Close all land here) — means no path, present or future, can slip
  // past the notify; a per-callsite wrapper could. The ref skips the mount frame
  // and any non-transition re-render, so the callback fires only on a real flip:
  // it reports NET COMMITTED transitions, so StrictMode's double-invoked mount
  // never yields a spurious call.
  const previousOpenRef = useRef(open);
  useEffect(() => {
    if (previousOpenRef.current !== open) {
      previousOpenRef.current = open;
      onEditorOpenChange?.(open);
    }
  }, [open, onEditorOpenChange]);

  // Live mirrors the unmount cleanup below reads: an empty-dep cleanup captures
  // its closure at mount, so it must reach the CURRENT open state and callback
  // through refs rather than stale mount-time values.
  const openRef = useRef(open);
  const onEditorOpenChangeRef = useRef(onEditorOpenChange);
  useEffect(() => {
    openRef.current = open;
    onEditorOpenChangeRef.current = onEditorOpenChange;
  });

  // Unmount counts as a close for the muting contract: if the field is torn down
  // while the editor is open (a host route swap, an error boundary above), none
  // of the normal close paths run — so without this a host would leave its global
  // shortcuts muted forever. Empty deps means this fires ONLY at unmount; it can
  // never double-fire with a normal close, which flips `open` to false first, so
  // `openRef.current` already reads false here.
  useEffect(
    () => () => {
      if (openRef.current) onEditorOpenChangeRef.current?.(false);
    },
    [],
  );

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

/**
 * Full-screen visual jq editor, built on the primitives `Dialog` fullscreen variant
 * so it shares one layer system with the child Load/Test dialogs it opens (stacking
 * then follows Radix portal order instead of a z-index race). `contentClassName`
 * hangs the library root class on the Radix content element so the scoped styles
 * reach inside the portal; `chromeless` drops the `Dialog`'s forced Title/stack so
 * the editor renders its own toolbar. The focus trap and focus restore come from the
 * primitives `Dialog`; Escape closes through Radix's `onOpenChange`.
 *
 * The toolbar carries the field title, a CONTEXT CHIP naming what `.` is (from
 * the field's input-shape descriptor), a Legend, and the Cancel / Save actions.
 * Save's disabled reason lives on its `title` (flow toolbar idiom — the title
 * says why). While open it flips the editor open-gate so the surrounding flow
 * editor's save shortcut stays muted and Cmd/Ctrl+S saves the expression here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';
import { Badge, Button, ConfirmDialog, Dialog, Tooltip } from './primitives';
import { TransformerEditor } from './transformer-editor';
import { JqLegendDialog } from './JqLegendDialog';
import { LOGIC_LESS_SAVE_MESSAGE } from './TransformerCanvas';
import { useJQEditorState } from './editor-context';
import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  ServerValidateHook,
} from './declaration';

/** Library root scoping class + the editor's full-screen layout class. */
const JQ_EDITOR_CONTENT_CLASS = 'jq-studio-root jqs-jq-fullscreen';

export interface JQEditorDialogProps {
  open: boolean;
  initialExpression: string;
  fieldLabel?: string;
  /** What `.` IS for this field — drives the toolbar context chip, the Test
   *  panel's seeded sample, and (host-agnostic) any shape-aware surface. Absent =
   *  today's behaviour (no chip, blank Test input). */
  shape?: JqInputShapeDescriptor;
  /** A live sample-input provider for the Test panel. Takes precedence over the
   *  static `shape.sample` skeleton when it yields a defined value (the
   *  declaration's dynamic-sample contract). Absent = seed from `shape.sample`. */
  sampleInput?: SampleInputProvider;
  /** Pluggable server-validate hook surfaced in the Test panel when a host wires
   *  one (a consumer's `serverValidate` hook). */
  serverValidate?: ServerValidateHook;
  onSave: (expression: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}

/** The toolbar context chip: a tinted badge naming the `.` shape, with a tooltip
 *  spelling out the top-level keys and what the expression must return. */
const ContextChip = ({ shape }: { shape: JqInputShapeDescriptor }) => (
  <Tooltip
    content={
      <div className="jq-studio-root jqs-jq-context-tip">
        <p className="jqs-jq-context-tip__blurb">{shape.blurb}</p>
        {shape.keys.length > 0 && (
          <dl className="jqs-jq-context-tip__keys">
            {shape.keys.map((key) => (
              <div key={key.name} className="jqs-jq-context-tip__key">
                <dt>
                  <code>.{key.name}</code>
                </dt>
                <dd>{key.gloss}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="jqs-jq-context-tip__returns">Must return {shape.returns}.</p>
        {shape.caveats?.map((caveat) => (
          <p key={caveat} className="jqs-jq-context-tip__caveat">
            {caveat}
          </p>
        ))}
      </div>
    }
  >
    <span className="jqs-jq-context-chip">
      <Badge variant="info">in: {shape.label}</Badge>
    </span>
  </Tooltip>
);

export const JQEditorDialog = ({
  open,
  initialExpression,
  fieldLabel,
  shape,
  sampleInput,
  serverValidate,
  onSave,
  onClose,
  readOnly,
}: JQEditorDialogProps) => {
  const { setJQEditorOpen } = useJQEditorState();
  const [currentExpression, setCurrentExpression] = useState(initialExpression);
  const [hasErrors, setHasErrors] = useState(false);
  const [hasLogicNode, setHasLogicNode] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The editor's FIRST emitted expression is the canvas's own serialisation of
  // the loaded graph — which can differ harmlessly from `initialExpression` (a
  // faithful reformat). Comparing edits against THAT baseline, not the raw input,
  // keeps a pure round-trip from reading as an unsaved change.
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentExpression(initialExpression);
      setSaveError(null);
      setConfirmDiscard(false);
      baselineRef.current = null;
    }
  }, [initialExpression, open]);

  // Track the round-trip baseline, then the user's edits against it.
  const handleExpressionChange = useCallback((expression: string) => {
    baselineRef.current ??= expression;
    setCurrentExpression(expression);
  }, []);

  // A save refused for being logic-less clears itself once a logic node exists.
  useEffect(() => {
    if (hasLogicNode) setSaveError(null);
  }, [hasLogicNode]);

  // Drive the open-gate so the outer editor's save shortcut stays muted.
  useEffect(() => {
    setJQEditorOpen(open);
    return () => {
      setJQEditorOpen(false);
    };
  }, [open, setJQEditorOpen]);

  // The single refusal message for a logic-less save, shown for both surfaces:
  // this Save button and the canvas's Cmd/Ctrl+S (via `onLogicLessSave`).
  const refuseLogicLessSave = useCallback(() => {
    setSaveError(LOGIC_LESS_SAVE_MESSAGE);
  }, []);

  // A logic-less canvas has no transformer to persist, so the save is refused;
  // other errors keep the button disabled instead.
  const handleSave = useCallback(() => {
    if (!hasLogicNode) {
      refuseLogicLessSave();
      return;
    }
    setSaveError(null);
    onSave(currentExpression);
  }, [currentExpression, hasLogicNode, onSave, refuseLogicLessSave]);

  // Close guarded by a dirty check: Escape / overlay / Cancel all route here, so
  // an unsaved edit is never dropped silently — a changed expression prompts a
  // confirm; a clean editor (or read-only viewer) closes straight through.
  const requestClose = useCallback(() => {
    const dirty =
      !readOnly && baselineRef.current !== null && currentExpression !== baselineRef.current;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [readOnly, currentExpression, onClose]);

  // An em-dash separates the field's own label from the mode suffix so a long
  // field title (e.g. "Fill expression for … items") never runs straight into
  // the word "Editor"/"Viewer" as one string.
  const title = `${fieldLabel ?? 'Expression'} — ${readOnly ? 'Viewer' : 'Editor'}`;
  // Save is disabled only when the graph HAS logic but carries other errors — the
  // reason rides the button title (the toolbar idiom: the title says why).
  const saveDisabled = hasErrors && hasLogicNode;
  const saveTitle = saveDisabled
    ? 'Fix the problems on the canvas before saving.'
    : 'Save this expression';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      fullscreen
      chromeless
      contentClassName={JQ_EDITOR_CONTENT_CLASS}
      title={title}
    >
      <div className="jqs-jq-fullscreen__header">
        <div className="jqs-jq-fullscreen__title-group">
          <h2 className="jqs-jq-fullscreen__title">{title}</h2>
          {shape && <ContextChip shape={shape} />}
        </div>
        <div className="jqs-jq-fullscreen__actions">
          <JqLegendDialog />
          <span className="jqs-jq-fullscreen__divider" aria-hidden />
          <Button onClick={requestClose}>
            <X className="jqs-jq-icon" />
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            // Enabled when logic-less so the click surfaces the refusal message;
            // disabled only when the graph has logic but carries other errors.
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saveDisabled}
              title={saveTitle}
            >
              <Save className="jqs-jq-icon" />
              Save
            </Button>
          )}
        </div>
      </div>

      {!readOnly && saveError && (
        <div className="jqs-jq-fullscreen__save-error jqs-jq-error-box" role="alert">
          <AlertCircle className="jqs-jq-icon-sm jqs-jq-err" />
          <p>{saveError}</p>
        </div>
      )}

      <div className="jqs-jq-fullscreen__body">
        <TransformerEditor
          initialExpression={initialExpression}
          onChange={readOnly ? undefined : handleExpressionChange}
          onSave={readOnly ? undefined : handleSave}
          onHasErrorsChange={readOnly ? undefined : setHasErrors}
          onHasLogicNodeChange={readOnly ? undefined : setHasLogicNode}
          onLogicLessSave={readOnly ? undefined : refuseLogicLessSave}
          shape={shape}
          sampleInput={sampleInput}
          serverValidate={serverValidate}
          onRequestClose={requestClose}
          readOnly={readOnly}
        />
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard"
          pendingLabel="Discarding"
          confirmVariant="danger"
          isPending={false}
          onConfirm={() => {
            setConfirmDiscard(false);
            onClose();
          }}
          onClose={() => {
            setConfirmDiscard(false);
          }}
        >
          <p>Your edits to this expression have not been saved. Closing will lose them.</p>
        </ConfirmDialog>
      )}
    </Dialog>
  );
};

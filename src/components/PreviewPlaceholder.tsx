import { AlertCircle, GitBranch } from 'lucide-react';
import type { PreviewStatus } from '../hooks/use-preview-status';

/** Neutral copy for VALID jq the node graph has no faithful shape for. Deliberately
 *  not an error: the expression compiles and runs, it just cannot be drawn here. */
const UNREPRESENTABLE_HINT =
  "This expression uses jq the visual editor can't display. It runs normally — edit it as text in Plain.";

/** Neutral copy for jq that DOES parse into a graph, but whose graph serialises
 *  back to different-behaving jq — the visual editor's reading of it does not
 *  match. Drawing (and later saving) that graph would silently corrupt the
 *  expression, so it is treated exactly like the unrepresentable case. */
const UNFAITHFUL_HINT =
  "The visual editor's reading of this expression doesn't match it exactly — edit it as text in Plain.";

interface PreviewPlaceholderProps {
  status: Exclude<PreviewStatus, { kind: 'graph' }>;
  emptyHint?: string;
  unshownHint?: string;
}

/** The non-graph states of the preview tile: a neutral "not shown here" notice for
 *  jq the editor cannot draw or read faithfully, a quiet checking/empty placeholder,
 *  or a loud alert for genuinely invalid jq. */
export const PreviewPlaceholder = ({ status, emptyHint, unshownHint }: PreviewPlaceholderProps) => {
  if (status.kind === 'unfaithful') {
    // A parsed-but-unfaithful reading: neutral notice, NOT an alert — the jq is
    // sound and running, the visual editor just cannot represent it losslessly.
    return (
      <div className="jqs-jq-preview jqs-jq-preview--empty" role="status">
        <GitBranch className="jqs-jq-preview__empty-icon" />
        <div className="jqs-jq-preview__empty-title">Not shown here</div>
        <div className="jqs-jq-preview__empty-hint">{unshownHint ?? UNFAITHFUL_HINT}</div>
      </div>
    );
  }

  if (status.kind === 'checking') {
    return (
      <div className="jqs-jq-preview jqs-jq-preview--empty">
        <GitBranch className="jqs-jq-preview__empty-icon" />
        <div className="jqs-jq-preview__empty-title">Checking expression…</div>
      </div>
    );
  }

  if (status.kind === 'unrepresentable') {
    // Valid jq the editor cannot draw: neutral notice, NOT an alert — the fallback
    // must not read as an error when the expression is sound and running.
    return (
      <div className="jqs-jq-preview jqs-jq-preview--empty" role="status">
        <GitBranch className="jqs-jq-preview__empty-icon" />
        <div className="jqs-jq-preview__empty-title">Not shown here</div>
        <div className="jqs-jq-preview__empty-hint">{unshownHint ?? UNREPRESENTABLE_HINT}</div>
        {status.construct && (
          <code className="jqs-jq-preview__empty-construct">{status.construct}</code>
        )}
      </div>
    );
  }

  if (status.kind === 'invalid') {
    // Genuinely malformed jq keeps the loud, alerting error.
    return (
      <div className="jqs-jq-preview jqs-jq-preview--empty jqs-jq-preview--invalid" role="alert">
        <AlertCircle className="jqs-jq-preview__empty-icon" />
        <div className="jqs-jq-preview__empty-title">Invalid expression</div>
        {emptyHint && <div className="jqs-jq-preview__empty-hint">{emptyHint}</div>}
      </div>
    );
  }

  // Either nothing to draw yet, or validity is still being checked — a quiet,
  // non-alerting placeholder for both.
  return (
    <div className="jqs-jq-preview jqs-jq-preview--empty">
      <GitBranch className="jqs-jq-preview__empty-icon" />
      <div className="jqs-jq-preview__empty-title">{status.headline}</div>
      {status.showEmptyHint && emptyHint && (
        <div className="jqs-jq-preview__empty-hint">{emptyHint}</div>
      )}
    </div>
  );
};

import { AlertTriangle } from 'lucide-react';
import { Button } from './primitives';

interface CanvasFallbackPanelProps {
  /** `unfaithful`: the graph reads back to different jq (neutral status);
   *  `parse`: the jq could not be drawn at all (loud alert). */
  variant: 'unfaithful' | 'parse';
  title: string;
  hint: string;
  initialExpression?: string;
  readOnly?: boolean;
  onRequestClose?: () => void;
  onStartEmpty: () => void;
}

/**
 * A non-destructive fallback shown instead of a mis-read or unparsable graph: the
 * author's original text is preserved verbatim and nothing is overwritten unless
 * they take the explicit "Start empty" opt-in (the ONLY path to a blank canvas).
 */
export const CanvasFallbackPanel = ({
  variant,
  title,
  hint,
  initialExpression,
  readOnly,
  onRequestClose,
  onStartEmpty,
}: CanvasFallbackPanelProps) => {
  const isParse = variant === 'parse';
  return (
    <div
      className={isParse ? 'jqs-jq-canvas__parse-fallback' : 'jqs-jq-canvas__entry-fallback'}
      role={isParse ? 'alert' : 'status'}
    >
      <div className="jqs-jq-parse-fallback__box">
        {isParse ? (
          <div className="jqs-jq-parse-fallback__head">
            <AlertTriangle className="jqs-jq-icon" aria-hidden />
            <p className="jqs-jq-parse-fallback__title">{title}</p>
          </div>
        ) : (
          <p className="jqs-jq-parse-fallback__title">{title}</p>
        )}
        <p className="jqs-jq-parse-fallback__hint">{hint}</p>
        <pre className="jqs-jq-parse-fallback__code">
          <code>{initialExpression}</code>
        </pre>
        <div className="jqs-jq-parse-fallback__actions">
          {onRequestClose && <Button onClick={onRequestClose}>Close</Button>}
          {!readOnly && (
            <Button variant="danger" onClick={onStartEmpty}>
              Start empty
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

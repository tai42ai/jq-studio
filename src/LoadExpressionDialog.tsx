/**
 * Imports a jq expression as a visual flow. A floating "Load" button opens a
 * dialog with an expression input; on load the expression is parsed and, on
 * success, replaces the canvas. Parse failures render verbatim and load nothing.
 */
import { useState, useCallback } from 'react';
import { Import, Upload, AlertCircle } from 'lucide-react';
import { Button, Dialog, Textarea, Tooltip } from './primitives';
import type { CSSProperties } from 'react';
import type { JQNode, JQEdge } from './types';
import { convertJQToFlow } from './utils/converters/flow-from-jq';

interface LoadExpressionDialogProps {
  onLoad: (nodes: JQNode[], edges: JQEdge[]) => void;
}

const errorTextareaStyle: CSSProperties = {
  fontFamily: 'var(--jq-font-mono)',
  resize: 'vertical',
  borderColor: 'var(--jq-color-danger)',
};

const textareaStyle: CSSProperties = { fontFamily: 'var(--jq-font-mono)', resize: 'vertical' };

export const LoadExpressionDialog = ({ onLoad }: LoadExpressionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleExpressionChange = useCallback(
    (value: string) => {
      setExpression(value);
      if (error) setError(null);
    },
    [error],
  );

  const handleLoad = useCallback(() => {
    const trimmed = expression.trim();
    if (!trimmed) return;

    try {
      const { nodes, edges } = convertJQToFlow(trimmed);
      onLoad(nodes, edges);
      setOpen(false);
      setExpression('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse expression');
    }
  }, [expression, onLoad]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setExpression('');
      setError(null);
    }
  }, []);

  return (
    <>
      <Tooltip
        content={
          <span className="jq-studio-root jqs-jq-tooltip">Load flow from jq expression</span>
        }
      >
        <span className="jqs-jq-float-btn-wrap">
          <Button
            onClick={() => {
              setOpen(true);
            }}
          >
            <Import className="jqs-jq-icon" />
            Load
          </Button>
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Load from Expression"
        description="Paste a jq expression to generate the visual flow"
      >
        <div className="jqs-jq-dialog-body">
          <div className="jqs-jq-field">
            <span className="jqs-jq-label">jq Expression</span>
            <Textarea
              value={expression}
              onChange={(e) => {
                handleExpressionChange(e.target.value);
              }}
              placeholder=". | map(.name) | sort"
              spellCheck={false}
              rows={6}
              style={error ? errorTextareaStyle : textareaStyle}
            />
          </div>

          {error && (
            <div className="jqs-jq-error-box">
              <AlertCircle className="jqs-jq-icon-sm jqs-jq-err" />
              <p>{error}</p>
            </div>
          )}

          <div className="jqs-jq-run-row">
            <Button variant="primary" onClick={handleLoad} disabled={!expression.trim()}>
              <Upload className="jqs-jq-icon" />
              Load
            </Button>
            <span className="jqs-jq-muted">This will replace the current flow</span>
          </div>
        </div>
      </Dialog>
    </>
  );
};

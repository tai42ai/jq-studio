/**
 * The visual jq editor: a draggable node palette beside the transformer canvas,
 * with a toggle to collapse the palette. Feeds the generated expression back to
 * the caller through `onChange` / `onSave`.
 */
import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './primitives';
import { TransformerProvider } from './TransformerContext';
import { TransformerCanvas } from './TransformerCanvas';
import { TransformerSidebar } from './TransformerSidebar';
import type { TransformersProps } from './types';

export const TransformerEditor = ({
  className,
  onChange,
  onSave,
  onHasErrorsChange,
  onHasLogicNodeChange,
  onLogicLessSave,
  shape,
  serverValidate,
  onRequestClose,
  initialExpression,
  readOnly,
}: TransformersProps) => {
  const [hasStartNode, setHasStartNode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!readOnly);

  return (
    <TransformerProvider readOnly={readOnly}>
      <div className={className ? `jqs-jq-editor ${className}` : 'jqs-jq-editor'}>
        {!readOnly && (
          <div className="jqs-jq-editor__toggle">
            <Button
              onClick={() => {
                setSidebarOpen((v) => !v);
              }}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="jqs-jq-icon" />
              ) : (
                <PanelLeftOpen className="jqs-jq-icon" />
              )}
              {sidebarOpen ? 'Hide List' : 'Show List'}
            </Button>
          </div>
        )}
        {!readOnly && sidebarOpen && <TransformerSidebar hasStartNode={hasStartNode} />}
        <div className="jqs-jq-editor__canvas">
          <TransformerCanvas
            initialExpression={initialExpression}
            onChange={onChange}
            onSave={onSave}
            onStartNodeChange={setHasStartNode}
            onHasErrorsChange={onHasErrorsChange}
            onHasLogicNodeChange={onHasLogicNodeChange}
            onLogicLessSave={onLogicLessSave}
            shape={shape}
            serverValidate={serverValidate}
            onRequestClose={onRequestClose}
            readOnly={readOnly}
          />
        </div>
      </div>
    </TransformerProvider>
  );
};

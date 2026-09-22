/**
 * Read-only thumbnail of a jq expression's flow graph.
 *
 * Rendered in the Editor tab of a jq-typed field's tabbed control, beside the
 * "Visual editor" button that opens the full editor — the author sees the shape
 * of what they have at a glance. Lean by design — no controls, minimap, or
 * keyboard listeners — so stacking it in a form never steals shortcuts from the
 * surrounding editor.
 */
import '@xyflow/react/dist/style.css';
import './transformers.css';

import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider } from '@xyflow/react';

import { PreviewPlaceholder } from './components/PreviewPlaceholder';
import { JQNodeType } from './enums';
import { usePreviewStatus } from './hooks/use-preview-status';
import { JqGradientEdge } from './jq-gradient-edge';
import { CommentNode } from './nodes/CommentNode';
import { ConditionNode } from './nodes/ConditionNode';
import { FunctionCallNode } from './nodes/FunctionCallNode';
import { FunctionDeclNode } from './nodes/FunctionDeclNode';
import { OperatorNode } from './nodes/OperatorNode';
import { StartNode } from './nodes/StartNode';
import { TryCatchNode } from './nodes/TryCatchNode';
import { ValueNode } from './nodes/ValueNode';
import { SnapshotProvider } from './SnapshotContext';
import { TransformerProvider } from './TransformerContext';
import type { ValidationErrorMap } from './utils/flow-validator';
import { ValidationProvider } from './ValidationContext';

const nodeTypes: NodeTypes = {
  [JQNodeType.Start]: StartNode,
  [JQNodeType.FunctionDecl]: FunctionDeclNode,
  [JQNodeType.FunctionCall]: FunctionCallNode,
  [JQNodeType.Value]: ValueNode,
  [JQNodeType.Operator]: OperatorNode,
  [JQNodeType.Condition]: ConditionNode,
  [JQNodeType.TryCatch]: TryCatchNode,
  [JQNodeType.Comment]: CommentNode,
};

const edgeTypes: EdgeTypes = {
  gradient: JqGradientEdge,
};

const EMPTY_VALIDATION: ValidationErrorMap = new Map();
const NOOP = () => undefined;

interface TransformerPreviewProps {
  expression: string;
  emptyHint?: string;
  /** Overrides the neutral "not shown here" copy for BOTH not-drawable paths —
   *  the parsed-but-unfaithful reading and the valid-but-unrepresentable jq. A
   *  host that frames the tile differently (e.g. a plain "text only" tile) can
   *  substitute its own line; absent, the built-in hints stand. */
  unshownHint?: string;
  /** Names (without `$`) of variables the host binds beside `.`; each is
   *  accepted as a valid path root so an expression that reads one still draws. */
  declaredVariables?: readonly string[];
}

export const TransformerPreview = ({
  expression,
  emptyHint,
  unshownHint,
  declaredVariables,
}: TransformerPreviewProps) => {
  const { nodes, edges, status } = usePreviewStatus(expression, declaredVariables);

  // The parsed graph is drawn only once proven faithful; every other state routes
  // to a non-graph placeholder.
  if (status.kind !== 'graph') {
    return <PreviewPlaceholder status={status} emptyHint={emptyHint} unshownHint={unshownHint} />;
  }

  return (
    <div className="jqs-jq-preview">
      <TransformerProvider readOnly>
        <ValidationProvider value={EMPTY_VALIDATION}>
          <SnapshotProvider value={NOOP}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'gradient' }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                preventScrolling={false}
                proOptions={{ hideAttribution: true }}
                minZoom={0.01}
                maxZoom={2}
                fitView
                fitViewOptions={{ padding: 0.1, minZoom: 0.01, maxZoom: 0.25 }}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              </ReactFlow>
            </ReactFlowProvider>
          </SnapshotProvider>
        </ValidationProvider>
      </TransformerProvider>
    </div>
  );
};

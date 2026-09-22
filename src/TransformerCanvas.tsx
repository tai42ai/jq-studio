import '@xyflow/react/dist/style.css';
import './transformers.css';

import type {
  Edge,
  EdgeTypes,
  Node,
  NodeChange,
  NodeTypes,
  OnEdgesChange,
  ReactFlowInstance,
} from '@xyflow/react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import clsx from 'clsx';
import type { DragEvent } from 'react';
import { useMemo, useRef } from 'react';

import { CanvasFallbackPanel } from './CanvasFallbackPanel';
import { CanvasToolbar } from './CanvasToolbar';
import { jqNodeColorVar } from './colors';
import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  SampleVariablesProvider,
  ServerValidateHook,
} from './declaration';
import { JQNodeType } from './enums';
import type { ConnectionHandlers } from './hooks/use-connection-handlers';
import { useConnectionHandlers } from './hooks/use-connection-handlers';
import { useEdgeGradients } from './hooks/use-edge-gradients';
import { useFitScheduler } from './hooks/use-fit-scheduler';
import { useFlowExpression } from './hooks/use-flow-expression';
import { useFlowProblems } from './hooks/use-flow-problems';
import { useInitialLoad } from './hooks/use-initial-load';
import { useJqUndoRedo } from './hooks/use-jq-undo-redo';
import { useNodePlacement } from './hooks/use-node-placement';
import { useSaveShortcut } from './hooks/use-save-shortcut';
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
import type { JQNodeData } from './types';
import type { ValidationErrorMap } from './utils/flow-validator';
import { ValidationProvider } from './ValidationContext';

/**
 * Shown when the visual editor's reading of the loaded expression does not match
 * the text — the round-trip would rewrite it. The graph is NOT adopted (so no
 * edit or save can be built on the mis-read base) and this neutral notice sends
 * the author to the text editor instead.
 */
export const UNFAITHFUL_ENTRY_MESSAGE =
  "The visual editor's reading of this expression doesn't match it exactly — edit it as text instead.";

/**
 * Shown, alongside the author's original expression, when the loaded jq cannot be
 * PARSED into a graph at all. It is deliberately non-destructive: the text is
 * preserved verbatim and never overwritten unless the author explicitly chooses
 * "Start empty".
 */
export const PARSE_FAILURE_MESSAGE = "This expression uses jq the visual editor can't draw yet.";

/**
 * Shown when a save is attempted on a canvas that carries no logic node — only
 * comments, or nothing. Such a canvas has no transformer to persist, so the
 * save is refused.
 */
export const LOGIC_LESS_SAVE_MESSAGE =
  'A transformer needs at least one node that transforms the input before it can be saved — ' +
  'a canvas with only comments (or nothing) has no logic to run.';

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

/** The fallback hint under each non-destructive notice — the text is preserved
 *  either way; only the lead-in punctuation differs between the two panels. */
const UNFAITHFUL_FALLBACK_HINT =
  'Your expression is kept exactly as written — edit it as text, or start a blank canvas.';
const PARSE_FALLBACK_HINT =
  'Your expression is kept exactly as written. Edit it as text, or start a blank canvas.';

interface TransformerCanvasProps {
  className?: string;
  initialExpression?: string;
  onChange?: (expression: string) => void;
  onSave?: (expression: string) => void;
  onStartNodeChange?: (hasStart: boolean) => void;
  onHasErrorsChange?: (hasErrors: boolean) => void;
  onHasLogicNodeChange?: (hasLogicNode: boolean) => void;
  onLogicLessSave?: () => void;
  /** What `.` is for this field — seeds the Test panel and (later) the context
   *  chip. Optional: absent = today's behaviour. */
  shape?: JqInputShapeDescriptor;
  /** Live sample-input provider; its defined result takes precedence over
   *  `shape.sample` when seeding the Test panel. */
  sampleInput?: SampleInputProvider;
  /** Live sample-variables provider; its entries take precedence over each
   *  variable's static `sample` when binding the Test run's `$name`s. */
  sampleVariables?: SampleVariablesProvider;
  /** Pluggable server-side validator surfaced in the Test panel when a host
   *  provides one (a consumer's `serverValidate` hook). */
  serverValidate?: ServerValidateHook;
  /** Close the surrounding editor (the parse-failure fallback's primary action). */
  onRequestClose?: () => void;
  readOnly?: boolean;
}

interface CanvasFlowProps {
  nodes: Node<JQNodeData>[];
  edges: Edge[];
  readOnly?: boolean;
  validationErrors: ValidationErrorMap;
  takeSnapshot: () => void;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  instanceRef: React.RefObject<ReactFlowInstance<Node<JQNodeData>> | null>;
  onNodesChange: (changes: NodeChange<Node<JQNodeData>>[]) => void;
  onEdgesChange: OnEdgesChange;
  connection: ConnectionHandlers;
  onDrop: (event: DragEvent) => void;
  onNodesDelete: () => void;
}

/** The React Flow surface with its snapshot/validation providers. Read-only mode
 *  withholds every mutating handler so the graph renders as a static viewer. */
const CanvasFlow = ({
  nodes,
  edges,
  readOnly,
  validationErrors,
  takeSnapshot,
  wrapperRef,
  instanceRef,
  onNodesChange,
  onEdgesChange,
  connection,
  onDrop,
  onNodesDelete,
}: CanvasFlowProps) => (
  <div ref={wrapperRef} className="jqs-jq-canvas__flow">
    <SnapshotProvider value={takeSnapshot}>
      <ValidationProvider value={validationErrors}>
        <ReactFlow<Node<JQNodeData>>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : connection.onConnect}
          onConnectStart={readOnly ? undefined : connection.onConnectStart}
          onConnectEnd={readOnly ? undefined : connection.onConnectEnd}
          onInit={(instance) => {
            instanceRef.current = instance;
          }}
          onDragOver={readOnly ? undefined : connection.onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          onNodesDelete={readOnly ? undefined : onNodesDelete}
          onEdgesDelete={readOnly ? undefined : takeSnapshot}
          onNodeDragStart={readOnly ? undefined : takeSnapshot}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          deleteKeyCode={readOnly ? null : 'Backspace'}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'gradient' }}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap nodeColor={(node: Node<JQNodeData>) => jqNodeColorVar[node.data.type]} />
        </ReactFlow>
      </ValidationProvider>
    </SnapshotProvider>
  </div>
);

export const TransformerCanvas = ({
  className,
  initialExpression,
  onChange,
  onSave,
  onStartNodeChange,
  onHasErrorsChange,
  onHasLogicNodeChange,
  onLogicLessSave,
  shape,
  sampleInput,
  sampleVariables,
  serverValidate,
  onRequestClose,
  readOnly,
}: TransformerCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // The names of the variables the host binds beside `.` — valid path roots
  // the converter must accept and the guard must not read as undefined.
  const declaredVariables = useMemo(
    () => (shape?.variables ?? []).map((variable) => variable.name),
    [shape],
  );
  const { instanceRef, scheduleFit } = useFitScheduler();
  const nodeCountersRef = useRef<Record<string, number>>({});
  const [nodes, setNodes, handleNodesChange] = useNodesState<Node<JQNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  const { takeSnapshot } = useJqUndoRedo<JQNodeData>({ nodes, edges, setNodes, setEdges });

  const { entryUnfaithful, parseFailed, initialLoadSettled, startEmpty } = useInitialLoad({
    initialExpression,
    declaredVariables,
    setNodes,
    setEdges,
    nodeCountersRef,
    scheduleFit,
  });

  const { expression, conversionFailed } = useFlowExpression(
    nodes,
    edges,
    onChange,
    initialLoadSettled,
  );

  const {
    validationErrors,
    problemNodeIds,
    problemCount,
    hasErrors,
    hasLogicNode,
    focusNextProblem,
  } = useFlowProblems({
    nodes,
    edges,
    conversionFailed,
    onHasErrorsChange,
    onStartNodeChange,
    onHasLogicNodeChange,
    instanceRef,
  });

  useSaveShortcut({
    onSave,
    expression,
    hasErrors,
    hasLogicNode,
    onLogicLessSave,
    parseFailed,
    readOnly,
  });

  const connection = useConnectionHandlers({ nodes, edges, setEdges, takeSnapshot });

  const { onDrop, handleLoadExpression, onNodesDelete, handleNodeChanges } = useNodePlacement({
    setNodes,
    setEdges,
    takeSnapshot,
    handleNodesChange,
    reactFlowWrapper,
    instanceRef,
    nodeCountersRef,
    scheduleFit,
    readOnly,
  });

  const renderedEdges = useEdgeGradients(nodes, edges);

  if (entryUnfaithful || parseFailed) {
    return (
      <div className={clsx('jqs-jq-canvas', className)}>
        <CanvasFallbackPanel
          variant={entryUnfaithful ? 'unfaithful' : 'parse'}
          title={entryUnfaithful ? UNFAITHFUL_ENTRY_MESSAGE : PARSE_FAILURE_MESSAGE}
          hint={entryUnfaithful ? UNFAITHFUL_FALLBACK_HINT : PARSE_FALLBACK_HINT}
          initialExpression={initialExpression}
          readOnly={readOnly}
          onRequestClose={onRequestClose}
          onStartEmpty={startEmpty}
        />
      </div>
    );
  }

  return (
    <div className={clsx('jqs-jq-canvas', className)}>
      {!readOnly && (
        <CanvasToolbar
          problemCount={problemCount}
          problemNodeIds={problemNodeIds}
          focusNextProblem={focusNextProblem}
          onLoad={handleLoadExpression}
          expression={expression}
          validationErrors={validationErrors}
          shape={shape}
          sampleInput={sampleInput}
          sampleVariables={sampleVariables}
          serverValidate={serverValidate}
        />
      )}

      <CanvasFlow
        nodes={nodes}
        edges={renderedEdges}
        readOnly={readOnly}
        validationErrors={validationErrors}
        takeSnapshot={takeSnapshot}
        wrapperRef={reactFlowWrapper}
        instanceRef={instanceRef}
        onNodesChange={handleNodeChanges}
        onEdgesChange={onEdgesChange}
        connection={connection}
        onDrop={onDrop}
        onNodesDelete={onNodesDelete}
      />

      {/* Live expression readout: the round-trip made visible while editing.
          A conversion failure shows the error note, not a pretend-jq string. The
          expression is bidi-isolated so an RTL string literal inside it cannot
          reorder the surrounding jq punctuation. */}
      <details className={clsx('jqs-jq-readout', conversionFailed && 'jqs-jq-readout--error')}>
        <summary className="jqs-jq-readout__summary">
          <span className="jqs-jq-readout__label">{conversionFailed ? 'error' : 'jq'}</span>
          <code className="jqs-jq-readout__line">
            <bdi>{expression || '(empty)'}</bdi>
          </code>
        </summary>
        <pre className="jqs-jq-readout__full">
          <code>{expression || '(empty)'}</code>
        </pre>
      </details>
    </div>
  );
};

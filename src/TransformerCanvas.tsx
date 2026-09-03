import '@xyflow/react/dist/style.css';
import './transformers.css';
import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import type { DragEvent } from 'react';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { Button } from './primitives';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import type {
  Node,
  Edge,
  Connection,
  NodeChange,
  OnConnect,
  OnConnectStart,
  OnConnectEnd,
  NodeTypes,
  EdgeTypes,
  ReactFlowInstance,
} from '@xyflow/react';
import { useJqUndoRedo } from './hooks/use-jq-undo-redo';
import { JqGradientEdge } from './jq-gradient-edge';
import { StartNode } from './nodes/StartNode';
import { ValueNode } from './nodes/ValueNode';
import { OperatorNode } from './nodes/OperatorNode';
import { ConditionNode } from './nodes/ConditionNode';
import { TryCatchNode } from './nodes/TryCatchNode';
import { FunctionDeclNode } from './nodes/FunctionDeclNode';
import { FunctionCallNode } from './nodes/FunctionCallNode';
import { CommentNode } from './nodes/CommentNode';
import type { JQNodeData, JQNode, JQEdge } from './types';
import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  ServerValidateHook,
} from './declaration';
import { jqNodeColorVar } from './colors';
import { validateJQConnection, dropEdgesOnTargetSlot } from './utils/validator';
import { JQNodeType, JQHandleIdPrefix, ValueType } from './enums';
import { useTransformerConnection } from './TransformerContext';
import { convertFlowToJQ } from './utils/converters/jq-from-flow';
import { validateFlow } from './utils/flow-validator';
import { ValidationProvider } from './ValidationContext';
import { SnapshotProvider } from './SnapshotContext';
import { JqTestPanel } from './JqTestPanel';
import { LoadExpressionDialog } from './LoadExpressionDialog';
import { convertJQToFlow } from './utils/converters/flow-from-jq';
import { roundTripVerdict } from './utils/converters/faithfulness-guard';

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
  /** Pluggable server-side validator surfaced in the Test panel when a host
   *  provides one (a consumer's `serverValidate` hook). */
  serverValidate?: ServerValidateHook;
  /** Close the surrounding editor (the parse-failure fallback's primary action). */
  onRequestClose?: () => void;
  readOnly?: boolean;
}

const NODE_TYPE_LABELS: Record<JQNodeType, string> = {
  [JQNodeType.Start]: 'start',
  [JQNodeType.FunctionDecl]: 'func_decl',
  [JQNodeType.FunctionCall]: 'func_call',
  [JQNodeType.Value]: 'value',
  [JQNodeType.Operator]: 'operator',
  [JQNodeType.Condition]: 'condition',
  [JQNodeType.TryCatch]: 'try_catch',
  [JQNodeType.Comment]: 'comment',
};

const createDefaultNodeData = (type: JQNodeType, name?: string): JQNodeData => {
  switch (type) {
    case JQNodeType.Start:
      return { type: JQNodeType.Start, name };
    case JQNodeType.FunctionDecl:
      return { type: JQNodeType.FunctionDecl, name, parameters: [], bodyExpression: '.' };
    case JQNodeType.FunctionCall:
      return { type: JQNodeType.FunctionCall, callType: 'builtin', name };
    case JQNodeType.Operator:
      return { type: JQNodeType.Operator, name, operator: '+' };
    case JQNodeType.Value:
      return { type: JQNodeType.Value, name, valueType: ValueType.String, value: '' };
    case JQNodeType.Condition:
      return { type: JQNodeType.Condition, name, branches: [{ id: crypto.randomUUID() }] };
    case JQNodeType.TryCatch:
      return { type: JQNodeType.TryCatch, name };
    case JQNodeType.Comment:
      return { type: JQNodeType.Comment, text: '' };
  }
};

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
  serverValidate,
  onRequestClose,
  readOnly,
}: TransformerCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    Node<JQNodeData>
  > | null>(null);
  // Mirrors the instance for the fit scheduler, so a fit queued from an effect
  // that captured a null instance still reaches the live one at frame time.
  const instanceRef = useRef<ReactFlowInstance<Node<JQNodeData>> | null>(null);
  // The pending fit animation frame, cleared on a new fit and on unmount.
  const fitRafRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (fitRafRef.current !== null) cancelAnimationFrame(fitRafRef.current);
    },
    [],
  );
  // Animate to fit after a graph swap. Two nested frames: the first lets React
  // commit the new nodes, the second lets xyflow measure them, so fitView frames
  // the loaded layout rather than racing commit/measure on a wall-clock timer.
  const scheduleFit = useCallback((): void => {
    if (fitRafRef.current !== null) cancelAnimationFrame(fitRafRef.current);
    fitRafRef.current = requestAnimationFrame(() => {
      fitRafRef.current = requestAnimationFrame(() => {
        fitRafRef.current = null;
        instanceRef.current?.fitView({ padding: 0.2, duration: 800 }).catch((error: unknown) => {
          console.error('[TransformerCanvas] Failed to fit the loaded graph to view:', error);
        });
      });
    });
  }, []);
  const nodeCountersRef = useRef<Record<string, number>>({});
  const [nodes, setNodes, handleNodesChange] = useNodesState<Node<JQNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  const { startConnection, endConnection, registerAddNode } = useTransformerConnection();

  const { takeSnapshot } = useJqUndoRedo<JQNodeData>({ nodes, edges, setNodes, setEdges });

  const hasStartNode = useMemo(() => nodes.some((n) => n.type === JQNodeType.Start), [nodes]);

  // A logic node is any node that carries executable jq — everything but the
  // Start anchor and Comment annotations. A canvas with none is logic-less.
  const hasLogicNode = useMemo(
    () => nodes.some((n) => n.type !== JQNodeType.Start && n.type !== JQNodeType.Comment),
    [nodes],
  );

  useEffect(() => {
    onStartNodeChange?.(hasStartNode);
  }, [hasStartNode, onStartNodeChange]);

  useEffect(() => {
    onHasLogicNodeChange?.(hasLogicNode);
  }, [hasLogicNode, onHasLogicNodeChange]);

  // The ENTRY GUARD verdict: set when the loaded expression's graph reads back to
  // DIFFERENT jq, so the canvas shows a neutral fallback instead of the mis-read
  // graph. Like the parse-failure fallback it is non-destructive: the author's
  // original text is shown verbatim and the editable canvas stays gated behind an
  // explicit "Start empty" opt-in, so no edit or save can be built on a corrupt
  // base regardless of which parser bug caused the drift.
  const [entryUnfaithful, setEntryUnfaithful] = useState(false);

  // PARSE FAILURE (WP-A6): the loaded jq could not be turned into a graph at all.
  // Non-destructive — the author's original text is kept verbatim and shown in a
  // fallback panel; nothing is overwritten unless they choose "Start empty".
  const [parseFailed, setParseFailed] = useState(false);

  // The initial-load handshake. The canvas mounts with an EMPTY graph, which
  // `convertFlowToJQ` refuses (`# Error: Cannot convert empty graph …`), so the
  // very first `onChange` would emit that placeholder BEFORE the async initial
  // load adopts the real graph — and the surrounding dialog would capture the
  // placeholder as its dirty BASELINE, making every freshly-opened valid
  // expression read as an unsaved change (a spurious discard-confirm on close).
  // Holding emissions until the load has SETTLED (graph adopted, a fallback
  // reached, or there was nothing to load) means the first expression the dialog
  // ever sees — and pins as baseline — is the graph's first REAL serialization.
  const [initialLoadSettled, setInitialLoadSettled] = useState(false);

  // Load the initial expression once on mount (the dialog remounts the canvas
  // on each open, so this runs fresh per open). Adoption waits on the faithfulness
  // guard: the graph is taken only once proven to round-trip to the same behaviour.
  useEffect(() => {
    // An empty field has no graph to load: settle at once so a from-scratch
    // canvas still emits (its empty-graph state IS the honest baseline — a first
    // node the author then adds is a real edit that SHOULD prompt on close).
    if (!initialExpression?.trim()) {
      setInitialLoadSettled(true);
      return;
    }
    let loaded: { nodes: JQNode[]; edges: JQEdge[] };
    try {
      loaded = convertJQToFlow(initialExpression);
    } catch (e) {
      // A parse failure must NOT silently blank the canvas (the old
      // console-error-and-return would let a later one-node save overwrite the
      // author's expression). Surface the non-destructive fallback instead.
      console.error('[TransformerCanvas] Failed to load initial expression:', e);
      setParseFailed(true);
      setInitialLoadSettled(true);
      return;
    }
    let cancelled = false;
    void roundTripVerdict(initialExpression)
      .then((verdict) => {
        if (cancelled) return;
        if (verdict === 'unfaithful') {
          setEntryUnfaithful(true);
          setInitialLoadSettled(true);
          return;
        }
        setNodes(loaded.nodes);
        setEdges(loaded.edges);
        nodeCountersRef.current = {};
        scheduleFit();
        // Settle only now the real graph is committed, so the FIRST emission the
        // dialog captures as baseline is this graph's serialization, not the
        // pre-load empty-graph placeholder.
        setInitialLoadSettled(true);
      })
      .catch(() => {
        // The verdict path is rejection-safe today (every executor call is caught
        // upstream), but the settle invariant — the flag ALWAYS settles, or the
        // editor would never report a change — must not hinge on that staying true.
        if (!cancelled) setInitialLoadSettled(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The author's explicit opt-in to discard the loaded expression and build
  // afresh — the ONLY path from either non-destructive fallback (unparsable OR
  // unfaithfully-read) to an editable (blank) canvas. Until it is taken, the
  // original text is preserved verbatim and nothing is overwritten.
  const startEmpty = useCallback(() => {
    setParseFailed(false);
    setEntryUnfaithful(false);
  }, []);

  // Regenerate the jq expression whenever the graph changes. A conversion that
  // throws yields its message as the expression, so the canvas shows what broke;
  // `conversionFailed` marks that text as a placeholder rather than jq.
  const { expression, conversionFailed } = useMemo(() => {
    try {
      return { expression: convertFlowToJQ(nodes, edges), conversionFailed: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during conversion';
      console.error('[TransformerCanvas] Error converting flow to jq:', errorMsg);
      return { expression: `# Error: ${errorMsg}`, conversionFailed: true };
    }
  }, [nodes, edges]);

  useEffect(() => {
    // Suppress the pre-load empty-graph placeholder emission (see the
    // initial-load handshake above); emit only once the load has settled.
    if (!initialLoadSettled) return;
    onChange?.(expression);
  }, [expression, onChange, initialLoadSettled]);

  const validationErrors = useMemo(() => validateFlow(nodes, edges), [nodes, edges]);

  // The node ids the flow validator flags with an error-severity problem, in node
  // order — the error-summary chip cycles through these.
  const problemNodeIds = useMemo(() => {
    const ids: string[] = [];
    for (const node of nodes) {
      const errs = validationErrors.get(node.id);
      if (errs?.some((e) => e.severity === 'error')) ids.push(node.id);
    }
    return ids;
  }, [nodes, validationErrors]);

  // The count answers "why is Save disabled": a failed conversion is itself one
  // problem, on top of every errored node — but a still-EMPTY canvas is not a
  // problem, it just has nothing to convert yet, so it shows no chip.
  const problemCount = problemNodeIds.length + (conversionFailed && nodes.length > 0 ? 1 : 0);

  // A conversion the graph fails counts as an error of its own: the validator
  // checks the graph, not the converter's own conditions, so a graph it passes
  // can still leave the placeholder as the only text the canvas has.
  const hasErrors = useMemo(() => {
    if (conversionFailed) return true;
    for (const errors of validationErrors.values()) {
      if (errors.some((e) => e.severity === 'error')) return true;
    }
    return false;
  }, [validationErrors, conversionFailed]);

  useEffect(() => {
    onHasErrorsChange?.(hasErrors);
  }, [hasErrors, onHasErrorsChange]);

  // Clicking the error-summary chip frames the next errored node (read-only — no
  // snapshot), cycling through them so an off-screen problem is findable.
  const problemCursor = useRef(0);
  const focusNextProblem = useCallback(() => {
    if (problemNodeIds.length === 0) return;
    const index = problemCursor.current % problemNodeIds.length;
    problemCursor.current = index + 1;
    const nodeId = problemNodeIds[index];
    if (!nodeId) return;
    void instanceRef.current
      ?.fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 400 })
      .catch(() => undefined);
  }, [problemNodeIds]);

  // Cmd/Ctrl+S saves the current expression. Refused (never silently) while the
  // parse-failure fallback is up, when the canvas is logic-less (via
  // `onLogicLessSave`), or while any graph error holds the button disabled.
  useEffect(() => {
    if (!onSave || readOnly) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        if (parseFailed) return;
        if (!hasLogicNode) {
          onLogicLessSave?.();
          return;
        }
        if (hasErrors) return;
        onSave(expression);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave, expression, hasErrors, hasLogicNode, onLogicLessSave, parseFailed, readOnly]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const isValid = validateJQConnection(
        sourceNode.data.type,
        targetNode.data.type,
        connection.sourceHandle ?? '',
        connection.targetHandle ?? '',
      );
      if (!isValid) return;

      // One connection per source handle, except the Start node's "functions"
      // handle, which fans out to every declared function.
      const isMultipleAllowed =
        sourceNode.data.type === JQNodeType.Start &&
        connection.sourceHandle === JQHandleIdPrefix.Functions;

      if (!isMultipleAllowed) {
        const existingConnection = edges.find(
          (e) => e.source === connection.source && e.sourceHandle === connection.sourceHandle,
        );
        if (existingConnection) return;
      }

      takeSnapshot();

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'gradient',
            // Carry the two NODE TYPES (not baked colours); the edge renderer
            // resolves the gradient from the kind registry, so a colour is never
            // stale and the converter layer stays styling-free.
            data: {
              sourceType: sourceNode.data.type,
              targetType: targetNode.data.type,
              strokeWidth: 2,
            },
          },
          // A jq target port is single-input: REPLACE any wire already on this
          // exact slot rather than stacking a second the resolver would read
          // arbitrarily (e.g. two sources into one operator operand).
          dropEdgesOnTargetSlot(eds, connection.target, connection.targetHandle),
        ),
      );
    },
    [nodes, edges, setEdges, takeSnapshot],
  );

  const onConnectStart: OnConnectStart = useCallback(
    (_, { nodeId, handleId, handleType }) => {
      if (!nodeId) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      startConnection({
        sourceNodeId: nodeId,
        sourceNodeType: node.data.type,
        sourceHandleId: handleId ?? null,
        sourceHandleType: handleType ?? null,
        edges,
      });
    },
    [nodes, edges, startConnection],
  );

  const onConnectEnd: OnConnectEnd = useCallback(() => {
    endConnection();
  }, [endConnection]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Place a new node of `type` at a flow-space position, selecting it (and
  // deselecting the rest). Shared by drag-drop and the palette's click-to-add.
  const placeNode = useCallback(
    (type: JQNodeType, position: { x: number; y: number }) => {
      takeSnapshot();

      // Only FunctionDecl nodes get a default name; all others start nameless.
      let name: string | undefined;
      if (type === JQNodeType.FunctionDecl) {
        const label = NODE_TYPE_LABELS[type];
        nodeCountersRef.current[label] = (nodeCountersRef.current[label] ?? 0) + 1;
        name = `${label}_${String(nodeCountersRef.current[label])}`;
      }

      const newNode: Node<JQNodeData> = {
        id: `jq-${crypto.randomUUID()}`,
        type,
        position,
        selected: true,
        data: createDefaultNodeData(type, name),
      };

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
    },
    [setNodes, takeSnapshot],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const rawType = event.dataTransfer.getData('application/transformer-node-type');
      if (!rawType || !reactFlowInstance || !reactFlowWrapper.current) return;
      const type = rawType as JQNodeType;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      placeNode(type, position);
    },
    [reactFlowInstance, placeNode],
  );

  // Click-to-add (and thus keyboard Enter/Space) from the palette: drop the node
  // at the viewport CENTRE. Registered on the shared context so the palette —
  // which sits outside the flow instance — can trigger placement.
  const addNodeAtCenter = useCallback(
    (type: JQNodeType) => {
      const instance = instanceRef.current;
      const wrapper = reactFlowWrapper.current;
      let position = { x: 0, y: 0 };
      if (instance && wrapper) {
        const bounds = wrapper.getBoundingClientRect();
        position = instance.screenToFlowPosition({ x: bounds.width / 2, y: bounds.height / 2 });
      }
      placeNode(type, position);
    },
    [placeNode],
  );

  useEffect(() => {
    if (readOnly) return;
    registerAddNode(addNodeAtCenter);
    return () => {
      registerAddNode(null);
    };
  }, [readOnly, registerAddNode, addNodeAtCenter]);

  const handleLoadExpression = useCallback(
    (loadedNodes: JQNode[], loadedEdges: JQEdge[]) => {
      takeSnapshot();
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      nodeCountersRef.current = {};
      scheduleFit();
    },
    [setNodes, setEdges, scheduleFit, takeSnapshot],
  );

  const onNodesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  // In readOnly mode only selection changes pass through (expand/collapse);
  // otherwise every change applies.
  const handleNodeChanges = useCallback(
    (changes: NodeChange<Node<JQNodeData>>[]) => {
      if (!readOnly) {
        handleNodesChange(changes);
        return;
      }
      const selectChanges = changes.filter((c) => c.type === 'select');
      if (selectChanges.length > 0) handleNodesChange(selectChanges);
    },
    [readOnly, handleNodesChange],
  );

  const minimapNodeColor = useCallback(
    (node: Node<JQNodeData>) => jqNodeColorVar[node.data.type],
    [],
  );

  // Enrich edges with their two node TYPES from the live nodes, so the renderer
  // always paints a current gradient (and converter-built edges — which carry no
  // colours — pick up their gradient here too).
  const nodeTypeById = useMemo(() => {
    const map = new Map<string, JQNodeType>();
    for (const node of nodes) {
      if (node.type) map.set(node.id, node.type as JQNodeType);
    }
    return map;
  }, [nodes]);

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          sourceType: nodeTypeById.get(edge.source),
          targetType: nodeTypeById.get(edge.target),
        },
      })),
    [edges, nodeTypeById],
  );

  // The Test panel's seed, by declared precedence: a host's live `sampleInput()`
  // when it yields a defined value, else the shape's static `sample` skeleton,
  // else nothing (a blank input). A provider that throws or returns `undefined`
  // is treated as "no live sample" and falls back to the skeleton — a host seam
  // must never take the Test panel down.
  const testSample = useMemo(() => {
    if (sampleInput) {
      try {
        const live = sampleInput();
        if (live !== undefined) return JSON.stringify(live, null, 2);
      } catch {
        // Fall through to the static skeleton below.
      }
    }
    return shape?.sample !== undefined ? JSON.stringify(shape.sample, null, 2) : undefined;
  }, [sampleInput, shape]);

  return (
    <div className={clsx('jqs-jq-canvas', className)}>
      {entryUnfaithful ? (
        // The mis-read expression is NOT adopted: rather than a bare notice over an
        // empty editable canvas (which a one-node save could silently overwrite the
        // original with), show the author's text verbatim and gate the editable
        // canvas behind the same explicit "Start empty" opt-in as the parse fallback.
        // Neutral (role="status"), never an alert — the jq is sound, just not drawn
        // faithfully — the author is sent to the text editor instead.
        <div className="jqs-jq-canvas__entry-fallback" role="status">
          <div className="jqs-jq-parse-fallback__box">
            <p className="jqs-jq-parse-fallback__title">{UNFAITHFUL_ENTRY_MESSAGE}</p>
            <p className="jqs-jq-parse-fallback__hint">
              Your expression is kept exactly as written — edit it as text, or start a blank canvas.
            </p>
            <pre className="jqs-jq-parse-fallback__code">
              <code>{initialExpression}</code>
            </pre>
            <div className="jqs-jq-parse-fallback__actions">
              {onRequestClose && <Button onClick={onRequestClose}>Close</Button>}
              {!readOnly && (
                <Button variant="danger" onClick={startEmpty}>
                  Start empty
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : parseFailed ? (
        // WP-A6 — non-destructive parse-failure fallback: the author's text is
        // preserved verbatim and nothing is overwritten unless they opt in.
        <div className="jqs-jq-canvas__parse-fallback" role="alert">
          <div className="jqs-jq-parse-fallback__box">
            <div className="jqs-jq-parse-fallback__head">
              <AlertTriangle className="jqs-jq-icon" aria-hidden />
              <p className="jqs-jq-parse-fallback__title">{PARSE_FAILURE_MESSAGE}</p>
            </div>
            <p className="jqs-jq-parse-fallback__hint">
              Your expression is kept exactly as written. Edit it as text, or start a blank canvas.
            </p>
            <pre className="jqs-jq-parse-fallback__code">
              <code>{initialExpression}</code>
            </pre>
            <div className="jqs-jq-parse-fallback__actions">
              {onRequestClose && <Button onClick={onRequestClose}>Close</Button>}
              {!readOnly && (
                <Button variant="danger" onClick={startEmpty}>
                  Start empty
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {!readOnly && (
            <div className="jqs-jq-canvas__toolbar">
              <div className="jqs-jq-canvas__toolbar-spacer" />
              {problemCount > 0 && (
                <button
                  type="button"
                  className="jqs-jq-problem-chip"
                  onClick={focusNextProblem}
                  disabled={problemNodeIds.length === 0}
                  title={
                    problemNodeIds.length === 0
                      ? 'The generated expression could not be built'
                      : 'Jump to the next problem'
                  }
                >
                  <AlertTriangle className="jqs-jq-icon-sm" aria-hidden />
                  {problemCount} problem{problemCount === 1 ? '' : 's'}
                </button>
              )}
              <LoadExpressionDialog onLoad={handleLoadExpression} />
              <JqTestPanel
                expression={expression}
                validationErrors={validationErrors}
                sampleInput={testSample}
                shapeLabel={shape?.label}
                returns={shape?.returns}
                serverValidate={serverValidate}
              />
            </div>
          )}

          <div ref={reactFlowWrapper} className="jqs-jq-canvas__flow">
            <SnapshotProvider value={takeSnapshot}>
              <ValidationProvider value={validationErrors}>
                <ReactFlow<Node<JQNodeData>>
                  nodes={nodes}
                  edges={renderedEdges}
                  onNodesChange={handleNodeChanges}
                  onEdgesChange={readOnly ? undefined : onEdgesChange}
                  onConnect={readOnly ? undefined : onConnect}
                  onConnectStart={readOnly ? undefined : onConnectStart}
                  onConnectEnd={readOnly ? undefined : onConnectEnd}
                  onInit={(instance) => {
                    instanceRef.current = instance;
                    setReactFlowInstance(instance);
                  }}
                  onDragOver={readOnly ? undefined : onDragOver}
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
                  <MiniMap nodeColor={minimapNodeColor} />
                </ReactFlow>
              </ValidationProvider>
            </SnapshotProvider>
          </div>

          {/* Live expression readout: the round-trip made visible while editing.
              A conversion failure shows the error note, not a pretend-jq string. */}
          <details className={clsx('jqs-jq-readout', conversionFailed && 'jqs-jq-readout--error')}>
            <summary className="jqs-jq-readout__summary">
              <span className="jqs-jq-readout__label">{conversionFailed ? 'error' : 'jq'}</span>
              {/* Bidi-isolate the expression so an RTL string literal inside it
                  cannot reorder the surrounding jq punctuation in the readout. */}
              <code className="jqs-jq-readout__line">
                <bdi>{expression || '(empty)'}</bdi>
              </code>
            </summary>
            <pre className="jqs-jq-readout__full">
              <code>{expression || '(empty)'}</code>
            </pre>
          </details>
        </>
      )}
    </div>
  );
};

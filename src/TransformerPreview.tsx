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
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, GitBranch } from 'lucide-react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from '@xyflow/react';
import type { NodeTypes, EdgeTypes } from '@xyflow/react';
import { JqGradientEdge } from './jq-gradient-edge';
import { StartNode } from './nodes/StartNode';
import { ValueNode } from './nodes/ValueNode';
import { OperatorNode } from './nodes/OperatorNode';
import { ConditionNode } from './nodes/ConditionNode';
import { TryCatchNode } from './nodes/TryCatchNode';
import { FunctionDeclNode } from './nodes/FunctionDeclNode';
import { FunctionCallNode } from './nodes/FunctionCallNode';
import { CommentNode } from './nodes/CommentNode';
import { JQNodeType } from './enums';
import { TransformerProvider } from './TransformerContext';
import { ValidationProvider } from './ValidationContext';
import { SnapshotProvider } from './SnapshotContext';
import { convertJQToFlow } from './utils/converters/flow-from-jq';
import { roundTripVerdict } from './utils/converters/faithfulness-guard';
import { checkJqValidity, type JqValidity } from './utils/jq-loader';
import type { ValidationErrorMap } from './utils/flow-validator';

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

/** Pulls the offending fragment out of the converter's "Unable to parse jq
 *  expression: X" message so the neutral notice can name what it could not draw.
 *  Returns null for any other message, and trims an over-long fragment. */
function blockingConstruct(error: string | null): string | null {
  if (error === null) return null;
  const match = /Unable to parse jq expression:\s*([\s\S]+)$/.exec(error);
  const fragment = match?.[1]?.trim();
  if (!fragment) return null;
  return fragment.length > 80 ? `${fragment.slice(0, 79)}…` : fragment;
}

interface TransformerPreviewProps {
  expression: string;
  emptyHint?: string;
  /** Overrides the neutral "not shown here" copy for BOTH not-drawable paths —
   *  the parsed-but-unfaithful reading and the valid-but-unrepresentable jq. A
   *  host that frames the tile differently (e.g. a plain "text only" tile) can
   *  substitute its own line; absent, the built-in hints stand. */
  unshownHint?: string;
}

export const TransformerPreview = ({
  expression,
  emptyHint,
  unshownHint,
}: TransformerPreviewProps) => {
  const result = useMemo(() => {
    if (!expression.trim()) return { nodes: [], edges: [], error: null as string | null };
    try {
      const { nodes, edges } = convertJQToFlow(expression);
      return { nodes, edges, error: null as string | null };
    } catch (e) {
      return { nodes: [], edges: [], error: e instanceof Error ? e.message : 'parse error' };
    }
  }, [expression]);

  // The graph converter answers ONE question — can the visual editor draw this? —
  // and a "no" (`result.error`) does NOT mean the jq is broken. Runtime validity is
  // a SEPARATE signal, consulted only when the drawing failed, to tell a genuinely
  // malformed expression (loud) apart from valid jq the editor cannot draw (neutral).
  const drawFailed = result.error !== null && expression.trim() !== '';
  const [validity, setValidity] = useState<JqValidity | 'checking'>('checking');
  useEffect(() => {
    if (!drawFailed) return;
    let cancelled = false;
    setValidity('checking');
    void checkJqValidity(expression).then((next) => {
      if (!cancelled) setValidity(next);
    });
    return () => {
      cancelled = true;
    };
  }, [expression, drawFailed]);

  // A parse that SUCCEEDED is not enough to draw: the graph must also read back to
  // the SAME jq. The faithfulness guard serialises the parsed graph and compares
  // behaviour through the WASM oracle; an unfaithful reading is treated exactly
  // like the unrepresentable case, so a mis-parsed graph is never drawn (and never
  // becomes the thing a later save writes back). The check is async, so the graph
  // is withheld behind a neutral "checking" placeholder until it is proven faithful.
  const parsed = result.error === null && result.nodes.length > 0;
  const [faithful, setFaithful] = useState<'checking' | 'faithful' | 'unfaithful'>('checking');
  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    setFaithful('checking');
    void roundTripVerdict(expression).then((verdict) => {
      // `unparseable` cannot occur here (the graph parsed); fold it into the
      // safe side (do not draw) alongside `unfaithful`.
      if (!cancelled) setFaithful(verdict === 'faithful' ? 'faithful' : 'unfaithful');
    });
    return () => {
      cancelled = true;
    };
  }, [expression, parsed]);

  // The parsed graph is drawn only once proven faithful; every other state routes
  // to a non-graph placeholder below.
  if (result.nodes.length === 0 || faithful !== 'faithful') {
    // A parsed-but-unfaithful reading: neutral notice, NOT an alert — the jq is
    // sound and running, the visual editor just cannot represent it losslessly.
    if (parsed && faithful === 'unfaithful') {
      return (
        <div className="jqs-jq-preview jqs-jq-preview--empty" role="status">
          <GitBranch className="jqs-jq-preview__empty-icon" />
          <div className="jqs-jq-preview__empty-title">Not shown here</div>
          <div className="jqs-jq-preview__empty-hint">{unshownHint ?? UNFAITHFUL_HINT}</div>
        </div>
      );
    }

    // Parsed and still being checked for faithfulness: quiet placeholder.
    if (parsed && faithful === 'checking') {
      return (
        <div className="jqs-jq-preview jqs-jq-preview--empty">
          <GitBranch className="jqs-jq-preview__empty-icon" />
          <div className="jqs-jq-preview__empty-title">Checking expression…</div>
        </div>
      );
    }

    // Valid jq the editor cannot draw: neutral notice, NOT an alert — the fallback
    // must not read as an error when the expression is sound and running.
    if (drawFailed && validity === 'valid') {
      const construct = blockingConstruct(result.error);
      return (
        <div className="jqs-jq-preview jqs-jq-preview--empty" role="status">
          <GitBranch className="jqs-jq-preview__empty-icon" />
          <div className="jqs-jq-preview__empty-title">Not shown here</div>
          <div className="jqs-jq-preview__empty-hint">{unshownHint ?? UNREPRESENTABLE_HINT}</div>
          {construct && <code className="jqs-jq-preview__empty-construct">{construct}</code>}
        </div>
      );
    }

    // Genuinely malformed jq keeps the loud, alerting error.
    if (drawFailed && validity === 'invalid') {
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
    const headline = drawFailed
      ? 'Checking expression…'
      : expression.trim()
        ? 'Empty graph'
        : 'No expression yet';
    return (
      <div className="jqs-jq-preview jqs-jq-preview--empty">
        <GitBranch className="jqs-jq-preview__empty-icon" />
        <div className="jqs-jq-preview__empty-title">{headline}</div>
        {!drawFailed && emptyHint && <div className="jqs-jq-preview__empty-hint">{emptyHint}</div>}
      </div>
    );
  }

  return (
    <div className="jqs-jq-preview">
      <TransformerProvider readOnly>
        <ValidationProvider value={EMPTY_VALIDATION}>
          <SnapshotProvider value={NOOP}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={result.nodes}
                edges={result.edges}
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

/**
 * @fileoverview Covers how a Function Call node resolves its selectable functions
 * from the node's `callType`: the built-in registry categories, the flow's own
 * `def` declarations, and the hard failure on a call type that is neither.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlow, type NodeTypes } from '@xyflow/react';
import { JQHandleIdPrefix, JQNodeType } from '../enums';
import type { JQEdge, JQNode } from '../types';
import { TransformerProvider } from '../TransformerContext';
import { ValidationProvider } from '../ValidationContext';
import { SnapshotProvider } from '../SnapshotContext';
import { getFunctionDefById } from '../utils/function-registry';
import {
  createEdge,
  createFunctionCallNode,
  createFunctionDeclNode,
  createNullNode,
  createStartNode,
} from '../utils/converters/test-helpers';
import { FunctionCallNode } from './FunctionCallNode';
import { FunctionDeclNode } from './FunctionDeclNode';
import { StartNode } from './StartNode';

const nodeTypes: NodeTypes = {
  [JQNodeType.Start]: StartNode,
  [JQNodeType.FunctionDecl]: FunctionDeclNode,
  [JQNodeType.FunctionCall]: FunctionCallNode,
};

const renderFlow = (nodes: JQNode[], edges: JQEdge[] = []) =>
  render(
    <TransformerProvider>
      <ValidationProvider value={new Map()}>
        <SnapshotProvider value={() => undefined}>
          <div style={{ width: 800, height: 600 }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView />
          </div>
        </SnapshotProvider>
      </ValidationProvider>
    </TransformerProvider>,
  );

/** Builds a FunctionCall node for the given function + call type, marked selected so it renders expanded. */
const selectedCall = (selectedFunction: string, callType: string): JQNode => ({
  ...createFunctionCallNode('call', selectedFunction, { callType }),
  selected: true,
});

describe('FunctionCallNode function options', () => {
  it("should resolve 'builtin' against the built-in registry category", async () => {
    const mapFn = getFunctionDefById('map');
    expect(mapFn).not.toBeNull();
    const firstParam = mapFn!.params[0];
    expect(firstParam).toBeDefined();

    renderFlow([selectedCall('map', 'builtin')]);

    expect(await screen.findByText(mapFn!.description)).toBeInTheDocument();
    expect(screen.getByText(firstParam!.name)).toBeInTheDocument();
  });

  it("should resolve 'custom' against the flow's own function declarations", async () => {
    const start = createStartNode();
    const decl = createFunctionDeclNode('decl', ['limit'], { name: 'my_fn' });
    const edge = createEdge(
      'e-fn',
      start.id,
      decl.id,
      JQHandleIdPrefix.Functions,
      JQHandleIdPrefix.Top,
    );

    renderFlow([start, decl, selectedCall('my_fn', 'custom')], [edge]);

    expect(await screen.findByText('Custom function: my_fn')).toBeInTheDocument();
    expect(screen.getByText('limit')).toBeInTheDocument();
  });

  it('should throw listing the valid call types when the call type is unknown', () => {
    expect(() => renderFlow([selectedCall('map', 'iterator')])).toThrow(
      'Unknown function call type "iterator". Valid call types: builtin, custom.',
    );
  });
});

/**
 * A multi-arity builtin (`range`, `while`, …) is stored by the converter under
 * its bare NAME while the registry keys each overload by an arity-suffixed id
 * (`range_2`). The node must resolve the def by name + the connected-arg ARITY,
 * or it renders no param ports at all.
 */
describe('FunctionCallNode multi-arity resolution', () => {
  /** A call node wired to `argCount` positional args (its arity). */
  const callWithArgs = (selectedFunction: string, argCount: number): [JQNode[], JQEdge[]] => {
    const call = selectedCall(selectedFunction, 'builtin');
    const nodes: JQNode[] = [call];
    const edges: JQEdge[] = [];
    for (let i = 0; i < argCount; i++) {
      const arg = createNullNode(`arg${String(i)}`);
      nodes.push(arg);
      edges.push(
        createEdge(
          `e${String(i)}`,
          call.id,
          arg.id,
          `${JQHandleIdPrefix.Param}:${String(i)}`,
          JQHandleIdPrefix.Top,
        ),
      );
    }
    return [nodes, edges];
  };

  it('resolves `range` with two wired args to the two-arg overload (from / upto)', async () => {
    const [nodes, edges] = callWithArgs('range', 2);
    renderFlow(nodes, edges);
    // range_2's real parameter names render as ports…
    expect(await screen.findByText('from')).toBeInTheDocument();
    expect(screen.getByText('upto')).toBeInTheDocument();
    // …and NOT the three-arg overload's extra `by`.
    expect(screen.queryByText('by')).not.toBeInTheDocument();
  });

  it('resolves `while` to its condition / update params, named exactly once', () => {
    renderFlow([selectedCall('while', 'builtin')]);
    // Each param is named once — no duplicate ordinal (`arg 1` / `arg 2`) label.
    expect(screen.getAllByText('condition')).toHaveLength(1);
    expect(screen.getAllByText('update')).toHaveLength(1);
    expect(screen.queryByText('arg 1')).not.toBeInTheDocument();
    expect(screen.queryByText('arg 2')).not.toBeInTheDocument();
  });

  it('keeps a bare `first` (no wired args) at zero param ports', () => {
    // first's single param is OPTIONAL, so a bare call shows no port to fill.
    renderFlow([selectedCall('first', 'builtin')]);
    expect(screen.queryByText('filter')).not.toBeInTheDocument();
    expect(screen.queryByText('arg 1')).not.toBeInTheDocument();
  });
});

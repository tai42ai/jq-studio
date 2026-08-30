/**
 * @fileoverview Multi-role AND multi-slot ports must be GLANCEABLE. A collapsed
 * (unselected) card must name every port whose role/slot is otherwise an
 * anonymous dot: a Condition's if / then / else, a Try/Catch's try / catch, a
 * Define Function's body, an Operator's order-bearing `a` / `b` operands (in BOTH
 * states), a Call's positional args (real name or `arg n` ordinal), an object's
 * keys and an array's `[i]` indices. Ports that are genuinely unambiguous (an
 * operator card carries no branch words) stay bare so no noise is added.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlow, type NodeTypes } from '@xyflow/react';
import { JQNodeType, ValueType } from '../enums';
import type { JQNode } from '../types';
import { TransformerProvider } from '../TransformerContext';
import { ValidationProvider } from '../ValidationContext';
import { SnapshotProvider } from '../SnapshotContext';
import { getFunctionDefById } from '../utils/function-registry';
import {
  createConditionNode,
  createFunctionCallNode,
  createFunctionDeclNode,
  createOperatorNode,
  createStartNode,
  createTryCatchNode,
  createValueNode,
} from '../utils/converters/test-helpers';
import { ConditionNode } from './ConditionNode';
import { TryCatchNode } from './TryCatchNode';
import { FunctionDeclNode } from './FunctionDeclNode';
import { FunctionCallNode } from './FunctionCallNode';
import { OperatorNode } from './OperatorNode';
import { ValueNode } from './ValueNode';
import { StartNode } from './StartNode';

const nodeTypes: NodeTypes = {
  [JQNodeType.Start]: StartNode,
  [JQNodeType.Condition]: ConditionNode,
  [JQNodeType.TryCatch]: TryCatchNode,
  [JQNodeType.FunctionDecl]: FunctionDeclNode,
  [JQNodeType.FunctionCall]: FunctionCallNode,
  [JQNodeType.Operator]: OperatorNode,
  [JQNodeType.Value]: ValueNode,
};

const renderFlow = (nodes: JQNode[]) =>
  render(
    <TransformerProvider>
      <ValidationProvider value={new Map()}>
        <SnapshotProvider value={() => undefined}>
          <div style={{ width: 800, height: 600 }}>
            <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView />
          </div>
        </SnapshotProvider>
      </ValidationProvider>
    </TransformerProvider>,
  );

const selected = (node: JQNode): JQNode => ({ ...node, selected: true });

describe('control-flow ports render labels (collapsed)', () => {
  it('labels a collapsed Condition card if / then / else', () => {
    renderFlow([createConditionNode('cond', [{ id: 'b1' }])]);
    expect(screen.getByText('if')).toBeInTheDocument();
    expect(screen.getByText('then')).toBeInTheDocument();
    expect(screen.getByText('else')).toBeInTheDocument();
  });

  it('reads later predicates of a multi-branch Condition as "else if"', () => {
    renderFlow([createConditionNode('cond', [{ id: 'b1' }, { id: 'b2' }])]);
    expect(screen.getByText('if')).toBeInTheDocument();
    expect(screen.getByText('else if')).toBeInTheDocument();
    expect(screen.getAllByText('then')).toHaveLength(2);
    expect(screen.getByText('else')).toBeInTheDocument();
  });

  it('labels a collapsed Try/Catch card try / catch', () => {
    renderFlow([createTryCatchNode('tc')]);
    expect(screen.getByText('try')).toBeInTheDocument();
    expect(screen.getByText('catch')).toBeInTheDocument();
  });

  it('labels a collapsed Define Function body port', () => {
    renderFlow([createFunctionDeclNode('fn', [], { name: 'my_fn' })]);
    expect(screen.getByText('body')).toBeInTheDocument();
  });
});

describe('order-bearing operand / arg / key / index ports render labels', () => {
  it('labels an Operator card a / b in the collapsed state', () => {
    renderFlow([createOperatorNode('op', '-')]);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('labels an Operator card a / b in the expanded state too', () => {
    renderFlow([selected(createOperatorNode('op', '-'))]);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it("labels a collapsed Call's positional args with their real parameter names", () => {
    const mapFn = getFunctionDefById('map');
    expect(mapFn).not.toBeNull();
    const paramName = mapFn!.params[0]?.name;
    expect(paramName).toBeTruthy();
    renderFlow([createFunctionCallNode('call', 'map', { callType: 'builtin' })]);
    expect(screen.getByText(paramName!)).toBeInTheDocument();
  });

  it('labels collapsed object field ports with their key text', () => {
    renderFlow([
      createValueNode('obj', ValueType.Object, undefined, {
        fields: [
          { id: 'f1', name: 'channel' },
          { id: 'f2', name: 'user' },
        ],
      }),
    ]);
    expect(screen.getByText('channel')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('labels collapsed array item ports with their [i] index', () => {
    renderFlow([
      createValueNode('arr', ValueType.Array, undefined, {
        items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }],
      }),
    ]);
    expect(screen.getByText('[0]')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('[2]')).toBeInTheDocument();
  });
});

describe('unambiguous ports stay bare / one vocabulary', () => {
  it('leaves an Operator card free of any branch words', () => {
    renderFlow([createOperatorNode('op', '+')]);
    expect(screen.queryByText('if')).not.toBeInTheDocument();
    expect(screen.queryByText('then')).not.toBeInTheDocument();
    expect(screen.queryByText('else')).not.toBeInTheDocument();
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('names the Input node result port "Result" (matching its tooltip), not "Flow"', () => {
    renderFlow([createStartNode()]);
    expect(screen.getByText('Result')).toBeInTheDocument();
    expect(screen.queryByText('Flow')).not.toBeInTheDocument();
  });
});

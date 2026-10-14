/**
 * @fileoverview Number Value node input keeps the raw typed string and only
 * commits a finite parse — an empty or partial entry must never write `0`/`NaN`
 * into the node data. The value-type select switches the node's type, and a
 * value outside `ValueType` is rejected with an error before any state change.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type NodeTypes, ReactFlow, useNodes } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { JQNodeType, ValueType } from '../enums';
import type { AnySelectProps } from '../primitives';
import { PrimitivesProvider } from '../primitives';
import { SnapshotProvider } from '../SnapshotContext';
import { TransformerProvider } from '../TransformerContext';
import type { JQNode } from '../types';
import { createNumberNode, createStringNode } from '../utils/converters/test-helpers';
import { ValidationProvider } from '../ValidationContext';
import { ValueNode } from './ValueNode';

const nodeTypes: NodeTypes = { [JQNodeType.Value]: ValueNode };

/** Surfaces the stored `value` of the first node so a commit (or its absence) is observable. */
const StoredValue = () => {
  const nodes = useNodes();
  return <span data-testid="stored">{JSON.stringify(nodes[0]?.data.value)}</span>;
};

const renderNode = (node: JQNode) =>
  render(
    <TransformerProvider>
      <ValidationProvider value={new Map()}>
        <SnapshotProvider value={() => undefined}>
          <div style={{ width: 800, height: 600 }}>
            <ReactFlow defaultNodes={[node]} defaultEdges={[]} nodeTypes={nodeTypes} fitView>
              <StoredValue />
            </ReactFlow>
          </div>
        </SnapshotProvider>
      </ValidationProvider>
    </TransformerProvider>,
  );

const selectedNumber = (value: number): JQNode => ({
  ...createNumberNode('num', value),
  selected: true,
});

describe('ValueNode number input', () => {
  it('does not commit 0 for an empty box or NaN for a partial entry', async () => {
    renderNode(selectedNumber(5));
    const input = await screen.findByPlaceholderText<HTMLInputElement>('Enter number');
    expect(input.value).toBe('5');

    // Clearing the box must not write 0.
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(screen.getByTestId('stored').textContent).toBe('5');

    // A partial numeric entry must not write NaN.
    fireEvent.change(input, { target: { value: '-' } });
    expect(screen.getByTestId('stored').textContent).toBe('5');
  });

  it('commits only a finite parse', async () => {
    renderNode(selectedNumber(5));
    const input = await screen.findByPlaceholderText<HTMLInputElement>('Enter number');

    fireEvent.change(input, { target: { value: '42' } });
    expect(input.value).toBe('42');
    expect(screen.getByTestId('stored').textContent).toBe('42');
  });
});

describe('ValueNode string summary bidi isolation', () => {
  it('wraps a string literal’s text in <bdi> so an RTL value keeps its quotes', () => {
    const { container } = renderNode(createStringNode('s', 'مرحبا'));
    const bdi = container.querySelector('bdi');
    expect(bdi).not.toBeNull();
    expect(bdi?.textContent).toBe('مرحبا');
    // The quotes live OUTSIDE the isolate, so the visible summary is still quoted.
    expect(bdi?.parentElement?.textContent).toBe('"مرحبا"');
  });
});

describe('ValueNode value-type select', () => {
  /** Renders the node with a host Select that hands back the node's change handler. */
  const renderWithHostSelect = (node: JQNode) => {
    const takeSnapshot = vi.fn();
    let changeValueType: ((value: string) => void) | undefined;
    const HostSelect = (props: AnySelectProps) => {
      if (props['aria-label'] === 'Value type') changeValueType = props.onValueChange;
      return null;
    };
    const StoredValueType = () => {
      const nodes = useNodes();
      return <span data-testid="stored-type">{String(nodes[0]?.data.valueType)}</span>;
    };
    render(
      <PrimitivesProvider primitives={{ Select: HostSelect }}>
        <TransformerProvider>
          <ValidationProvider value={new Map()}>
            <SnapshotProvider value={takeSnapshot}>
              <div style={{ width: 800, height: 600 }}>
                <ReactFlow defaultNodes={[node]} defaultEdges={[]} nodeTypes={nodeTypes} fitView>
                  <StoredValueType />
                </ReactFlow>
              </div>
            </SnapshotProvider>
          </ValidationProvider>
        </TransformerProvider>
      </PrimitivesProvider>,
    );
    const select = (value: string): void => {
      if (!changeValueType) throw new Error('value-type select not rendered');
      changeValueType(value);
    };
    return { takeSnapshot, select };
  };

  it('switches the node to the chosen value type', async () => {
    const { takeSnapshot, select } = renderWithHostSelect(selectedNumber(5));
    expect((await screen.findByTestId('stored-type')).textContent).toBe(ValueType.Number);

    act(() => {
      select(ValueType.Boolean);
    });

    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('stored-type').textContent).toBe(ValueType.Boolean);
  });

  it('rejects a value outside ValueType before any state change', async () => {
    const { takeSnapshot, select } = renderWithHostSelect(selectedNumber(5));
    expect((await screen.findByTestId('stored-type')).textContent).toBe(ValueType.Number);

    expect(() => {
      select('notAValueType');
    }).toThrow(new Error('Unknown value type: notAValueType'));

    expect(takeSnapshot).not.toHaveBeenCalled();
    expect(screen.getByTestId('stored-type').textContent).toBe(ValueType.Number);
  });
});

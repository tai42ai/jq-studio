/**
 * @fileoverview Number Value node input keeps the raw typed string and only
 * commits a finite parse — an empty or partial entry must never write `0`/`NaN`
 * into the node data.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlow, useNodes, type NodeTypes } from '@xyflow/react';
import { JQNodeType } from '../enums';
import type { JQNode } from '../types';
import { TransformerProvider } from '../TransformerContext';
import { ValidationProvider } from '../ValidationContext';
import { SnapshotProvider } from '../SnapshotContext';
import { createNumberNode, createStringNode } from '../utils/converters/test-helpers';
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

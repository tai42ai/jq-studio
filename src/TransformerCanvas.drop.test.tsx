/**
 * @fileoverview Dropping onto the canvas: a palette node type places a node, a
 * drag that carries no node type (a file, plain text) is not the editor's and
 * places nothing, and a node type the editor does not know is rejected with an
 * error before anything is placed.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JQNodeType } from './enums';
import { TransformerCanvas } from './TransformerCanvas';
import { TransformerProvider } from './TransformerContext';

const { roundTripVerdictMock } = vi.hoisted(() => ({ roundTripVerdictMock: vi.fn() }));
vi.mock('./utils/converters/faithfulness-guard', () => ({
  roundTripVerdict: roundTripVerdictMock,
}));

/** Errors thrown from DOM event handlers reach the window as uncaught errors. */
let uncaught: unknown[] = [];
const recordUncaught = (event: ErrorEvent): void => {
  uncaught.push(event.error);
  event.preventDefault();
};

beforeEach(() => {
  roundTripVerdictMock.mockReset();
  roundTripVerdictMock.mockResolvedValue('faithful');
  uncaught = [];
  window.addEventListener('error', recordUncaught);
});

afterEach(() => {
  window.removeEventListener('error', recordUncaught);
});

const canvasNodes = (): NodeListOf<Element> => document.querySelectorAll('.react-flow__node');

const renderLoadedCanvas = async (): Promise<Element> => {
  render(
    <TransformerProvider>
      <TransformerCanvas initialExpression=".a" onSave={vi.fn()} />
    </TransformerProvider>,
  );
  await waitFor(() => {
    expect(canvasNodes().length).toBeGreaterThan(1);
  });
  const pane = document.querySelector('.react-flow');
  if (!pane) throw new Error('canvas pane not rendered');
  // React Flow hands its instance to the canvas one render after mount, and the
  // drop needs that instance to place the node; flush that render first.
  await act(() => Promise.resolve());
  return pane;
};

const dropNodeType = (pane: Element, nodeType: string): void => {
  fireEvent.drop(pane, {
    dataTransfer: {
      getData: (format: string) => (format === 'application/transformer-node-type' ? nodeType : ''),
    },
  });
};

describe('TransformerCanvas drop', () => {
  it('places a node for a palette node type', async () => {
    const pane = await renderLoadedCanvas();
    const before = canvasNodes().length;

    dropNodeType(pane, JQNodeType.Value);

    await waitFor(() => {
      expect(canvasNodes().length).toBe(before + 1);
    });
    expect(uncaught).toEqual([]);
  });

  it('places nothing for a drag that carries no node type', async () => {
    const pane = await renderLoadedCanvas();
    const before = canvasNodes().length;

    dropNodeType(pane, '');
    await act(() => Promise.resolve());

    expect(canvasNodes().length).toBe(before);
    expect(uncaught).toEqual([]);
  });

  it('rejects an unknown node type with an error and places nothing', async () => {
    const pane = await renderLoadedCanvas();
    const before = canvasNodes().length;

    dropNodeType(pane, 'jqNotANodeType');
    await act(() => Promise.resolve());

    expect(uncaught).toHaveLength(1);
    expect(uncaught[0]).toEqual(new Error('Unknown node type: jqNotANodeType'));
    expect(canvasNodes().length).toBe(before);
  });
});

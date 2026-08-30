/**
 * @fileoverview WP-A5 — the editor shell surfaced by the canvas: the live
 * expression READOUT (the round-trip made visible while editing) and the
 * error-summary CHIP that answers "why is Save disabled" (and jumps to the next
 * errored node). The floating corner buttons are replaced by a real toolbar.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransformerProvider } from './TransformerContext';
import { TransformerCanvas } from './TransformerCanvas';
import { JQNodeType } from './enums';

const { roundTripVerdictMock } = vi.hoisted(() => ({ roundTripVerdictMock: vi.fn() }));
vi.mock('./utils/converters/faithfulness-guard', () => ({
  roundTripVerdict: roundTripVerdictMock,
}));

beforeEach(() => {
  roundTripVerdictMock.mockReset();
  roundTripVerdictMock.mockResolvedValue('faithful');
});

const renderCanvas = (initialExpression: string) =>
  render(
    <TransformerProvider>
      <TransformerCanvas initialExpression={initialExpression} onSave={vi.fn()} />
    </TransformerProvider>,
  );

const canvasNodes = (): NodeListOf<Element> => document.querySelectorAll('.react-flow__node');

const canvasLoaded = async (): Promise<void> => {
  await waitFor(() => {
    expect(canvasNodes().length).toBeGreaterThan(1);
  });
};

const dropOrphanValueNode = async (): Promise<void> => {
  const pane = document.querySelector('.react-flow');
  if (!pane) throw new Error('canvas pane not rendered');
  await act(() => Promise.resolve());
  const before = canvasNodes().length;
  fireEvent.drop(pane, {
    dataTransfer: {
      getData: (format: string) =>
        format === 'application/transformer-node-type' ? JQNodeType.Value : '',
    },
  });
  await waitFor(() => {
    expect(canvasNodes().length).toBe(before + 1);
  });
};

describe('TransformerCanvas editor shell', () => {
  it('shows the generated jq in the live readout strip', async () => {
    const { container } = renderCanvas('.a');
    await canvasLoaded();

    await waitFor(() => {
      const line = container.querySelector('.jqs-jq-readout__line');
      expect(line?.textContent).toBe('.a');
    });
  });

  it('surfaces an error-summary chip once the graph carries a problem', async () => {
    renderCanvas('.a');
    await canvasLoaded();

    // A clean graph has no chip.
    expect(screen.queryByText(/problem/)).not.toBeInTheDocument();

    // An orphan node the validator rejects raises the chip.
    await dropOrphanValueNode();
    await waitFor(() => {
      expect(screen.getByText(/problem/)).toBeInTheDocument();
    });
  });
});

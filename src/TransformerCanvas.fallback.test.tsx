/**
 * @fileoverview WP-A6 — the non-destructive parse-failure fallback. When the
 * loaded jq cannot be parsed into a graph, the canvas must NOT blank silently
 * (the old hazard: a later one-node save would overwrite the author's text).
 * Instead it shows the original expression verbatim with explicit Close / Start
 * empty actions, and refuses a save until the author opts in.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The loaded expression cannot be drawn: the graph converter throws on parse.
vi.mock('./utils/converters/flow-from-jq', () => ({
  convertJQToFlow: () => {
    throw new Error('Unable to parse jq expression: reduce . as $x (0; . + $x)');
  },
}));

import { TransformerProvider } from './TransformerContext';
import { TransformerCanvas, PARSE_FAILURE_MESSAGE } from './TransformerCanvas';

const UNPARSABLE = 'reduce . as $x (0; . + $x)';

const renderCanvas = (overrides?: {
  onRequestClose?: () => void;
  onSave?: () => void;
  onLogicLessSave?: () => void;
}) => {
  render(
    <TransformerProvider>
      <TransformerCanvas
        initialExpression={UNPARSABLE}
        onRequestClose={overrides?.onRequestClose}
        onSave={overrides?.onSave}
        onLogicLessSave={overrides?.onLogicLessSave}
      />
    </TransformerProvider>,
  );
};

describe('TransformerCanvas parse-failure fallback', () => {
  it('shows the failure notice AND the original expression verbatim, never a blank canvas', async () => {
    renderCanvas();

    await waitFor(() => {
      expect(screen.getByText(PARSE_FAILURE_MESSAGE)).toBeInTheDocument();
    });
    // The author's text is preserved on screen exactly as written.
    expect(screen.getByText(UNPARSABLE)).toBeInTheDocument();
    // No graph was adopted.
    expect(document.querySelectorAll('.react-flow__node').length).toBe(0);
  });

  it('Close routes to the surrounding editor without touching the expression', async () => {
    const onRequestClose = vi.fn();
    renderCanvas({ onRequestClose });

    const closeBtn = await screen.findByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('Start empty is the explicit opt-in that clears the fallback to a blank canvas', async () => {
    renderCanvas();

    const startEmpty = await screen.findByRole('button', { name: 'Start empty' });
    fireEvent.click(startEmpty);

    // The fallback is gone; the editing surface (toolbar + readout) is shown.
    await waitFor(() => {
      expect(screen.queryByText(PARSE_FAILURE_MESSAGE)).not.toBeInTheDocument();
    });
  });

  it('refuses Cmd/Ctrl+S while the fallback is up (no silent overwrite)', async () => {
    const onSave = vi.fn();
    const onLogicLessSave = vi.fn();
    renderCanvas({ onSave, onLogicLessSave });

    await screen.findByText(PARSE_FAILURE_MESSAGE);
    fireEvent.keyDown(window, { key: 's', metaKey: true });

    expect(onSave).not.toHaveBeenCalled();
    expect(onLogicLessSave).not.toHaveBeenCalled();
  });
});

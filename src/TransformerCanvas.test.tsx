/**
 * @fileoverview Covers the canvas's Cmd/Ctrl+S shortcut. It refuses a logic-less
 * canvas via `onLogicLessSave` (the container surfaces the message), and
 * otherwise saves exactly what the Save button saves: nothing while the graph
 * carries an error, whether the conversion to jq threw or the flow validator
 * rejected the graph the converter happily skipped over.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransformerProvider } from './TransformerContext';
import { TransformerCanvas, UNFAITHFUL_ENTRY_MESSAGE } from './TransformerCanvas';
import { JQNodeType } from './enums';

// The entry guard's verdict is driven deterministically here; the real oracle is
// exercised by the converter/faithfulness suites. Default: faithful, so a loaded
// expression is adopted as before.
const { roundTripVerdictMock } = vi.hoisted(() => ({ roundTripVerdictMock: vi.fn() }));
vi.mock('./utils/converters/faithfulness-guard', () => ({
  roundTripVerdict: roundTripVerdictMock,
}));

beforeEach(() => {
  roundTripVerdictMock.mockReset();
  roundTripVerdictMock.mockResolvedValue('faithful');
});

/** A chain of nothing but a comment: a Start anchor and a comment, no logic node. */
const COMMENTS_ONLY = '# note';

interface CanvasHandles {
  onSave: ReturnType<typeof vi.fn>;
  onChange: ReturnType<typeof vi.fn>;
  onLogicLessSave: ReturnType<typeof vi.fn>;
}

const renderCanvas = (initialExpression: string): CanvasHandles => {
  const handles: CanvasHandles = {
    onSave: vi.fn(),
    onChange: vi.fn(),
    onLogicLessSave: vi.fn(),
  };
  render(
    <TransformerProvider>
      <TransformerCanvas
        initialExpression={initialExpression}
        onSave={handles.onSave}
        onChange={handles.onChange}
        onLogicLessSave={handles.onLogicLessSave}
      />
    </TransformerProvider>,
  );
  return handles;
};

const canvasNodes = (): NodeListOf<Element> => document.querySelectorAll('.react-flow__node');

/** Resolves once the loaded expression has been laid out as canvas nodes. */
const canvasLoaded = async (): Promise<void> => {
  await waitFor(() => {
    expect(canvasNodes().length).toBeGreaterThan(1);
  });
};

/** Drops a palette node onto the canvas, leaving it unconnected to the flow. */
const dropOrphanValueNode = async (): Promise<void> => {
  const pane = document.querySelector('.react-flow');
  if (!pane) throw new Error('canvas pane not rendered');
  // React Flow hands its instance to the canvas one render after mount, and the
  // drop needs that instance to place the node; flush that render first.
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

const pressSaveShortcut = (): void => {
  fireEvent.keyDown(window, { key: 's', metaKey: true });
};

describe('TransformerCanvas save shortcut', () => {
  it('should save a graph that converts and validates', async () => {
    const { onSave } = renderCanvas('.a');

    await canvasLoaded();
    pressSaveShortcut();

    expect(onSave).toHaveBeenCalledWith('.a');
  });

  it('should refuse a logic-less canvas via onLogicLessSave instead of saving', async () => {
    const { onSave, onLogicLessSave } = renderCanvas(COMMENTS_ONLY);

    await canvasLoaded();
    pressSaveShortcut();

    expect(onSave).not.toHaveBeenCalled();
    expect(onLogicLessSave).toHaveBeenCalledTimes(1);
  });

  it('refuses to adopt a graph whose reading is unfaithful, shows the text verbatim, and blocks the save', async () => {
    // The parser builds a graph, but the guard reports it round-trips to different
    // jq. The ENTRY GUARD must not adopt it: the canvas shows the neutral fallback
    // with the author's text preserved verbatim, stays logic-less, and a save is
    // refused instead of writing corrupted jq.
    roundTripVerdictMock.mockResolvedValue('unfaithful');
    const { onSave, onLogicLessSave } = renderCanvas('.a');

    await waitFor(() => {
      expect(screen.getByText(UNFAITHFUL_ENTRY_MESSAGE)).toBeInTheDocument();
    });
    // No graph nodes were adopted (only the guard fallback is shown)...
    expect(canvasNodes().length).toBe(0);
    // ...and the author's original expression is preserved verbatim, not blanked.
    expect(screen.getByText('.a')).toBeInTheDocument();

    pressSaveShortcut();
    expect(onSave).not.toHaveBeenCalled();
    expect(onLogicLessSave).toHaveBeenCalledTimes(1);
  });

  it('gates the editable canvas behind an explicit "Start empty" opt-in on an unfaithful entry', async () => {
    // The editable canvas is withheld until the author opts in — so a one-node
    // save can never silently overwrite the mis-read original.
    roundTripVerdictMock.mockResolvedValue('unfaithful');
    renderCanvas('.a');

    const startEmpty = await screen.findByRole('button', { name: 'Start empty' });
    // No canvas surface (no readout) while the fallback is up.
    expect(document.querySelector('.jqs-jq-readout')).toBeNull();

    fireEvent.click(startEmpty);

    // The fallback is gone and the editable surface (its readout strip) appears.
    await waitFor(() => {
      expect(screen.queryByText(UNFAITHFUL_ENTRY_MESSAGE)).not.toBeInTheDocument();
    });
    expect(document.querySelector('.jqs-jq-readout')).not.toBeNull();
  });

  it('should not save a graph that converts but fails flow validation', async () => {
    const { onSave, onChange } = renderCanvas('.a');

    await canvasLoaded();
    await dropOrphanValueNode();

    // The orphan node is invisible to the converter, so the conversion still
    // yields jq — the validator alone is what holds the save back.
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('.a');
    });

    pressSaveShortcut();

    expect(onSave).not.toHaveBeenCalled();
  });
});

/**
 * The drop-in `JqField`: the resting control reflects and edits the value, the
 * "Visual editor" button opens the editor dialog, and a host can substitute the
 * button through `PrimitivesProvider` (the injection seam).
 */
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// The Test panel preloads the jq WASM runner on open; jsdom has no WASM fetch, so
// stub the runner (the seed path under test needs no evaluation) — mirrors
// JqTestPanel.test.tsx.
vi.mock('./hooks/useJqRunner', () => ({
  useJqRunner: () => ({
    result: null,
    isRunning: false,
    run: vi.fn(),
    clear: vi.fn(),
    preload: vi.fn(),
  }),
}));

import { JqField } from './JqField';
import { PrimitivesProvider } from './primitives';
import type { AnyButtonProps } from './primitives';
import type { JqInputShapeDescriptor } from './declaration';

/** A minimal shape whose static skeleton the Test panel seeds from unless a live
 *  `sampleInput` overrides it. */
const RECORD_SHAPE: JqInputShapeDescriptor = {
  id: 'test:record',
  label: 'record',
  blurb: 'A record.',
  keys: [],
  returns: 'an object',
  sample: { a: 1 },
};

/** Opens the visual editor, waits for the canvas to lay out the loaded graph,
 *  opens the Test panel, and returns the seeded JSON-input value — the end-to-end
 *  path a live `sampleInput` / static `shape.sample` travels to reach the seed. */
const readTestSeed = async (): Promise<string> => {
  fireEvent.click(screen.getByRole('button', { name: /visual editor/i }));
  await waitFor(() => {
    expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(1);
  });
  const testButton = await screen.findByRole('button', { name: /Test/ });
  await waitFor(() => {
    expect(testButton).toBeEnabled();
  });
  fireEvent.click(testButton);
  const seed = await screen.findByPlaceholderText(/Sample record JSON/);
  return (seed as HTMLTextAreaElement).value;
};

describe('JqField', () => {
  it('renders the label and reflects the value in the resting control', () => {
    render(<JqField label="Transform" value=".a" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Transform');
    expect(input).toHaveValue('.a');
  });

  it('reports edits to the resting control through onChange', () => {
    const onChange = vi.fn();
    render(<JqField label="Transform" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Transform'), { target: { value: '.a' } });
    expect(onChange).toHaveBeenCalledWith('.a');
  });

  it('opens the visual editor dialog from the button', () => {
    render(<JqField label="Result" value=".a" onChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /visual editor/i }));
    expect(screen.getByRole('dialog', { name: /Result — Editor/ })).toBeInTheDocument();
  });

  it('renders read-only as a viewer affordance', () => {
    render(<JqField label="Result" value=".a" onChange={vi.fn()} readOnly />);
    expect(screen.getByRole('button', { name: /visual view/i })).toBeInTheDocument();
  });

  it('lets a host substitute the button through PrimitivesProvider', () => {
    const HostButton = (props: AnyButtonProps) => (
      <button {...(props.href === undefined ? props : {})} data-host-button="yes" />
    );
    render(
      <PrimitivesProvider primitives={{ Button: HostButton }}>
        <JqField label="Transform" value=".a" onChange={vi.fn()} />
      </PrimitivesProvider>,
    );
    const button = screen.getByRole('button', { name: /visual editor/i });
    expect(button).toHaveAttribute('data-host-button', 'yes');
  });

  describe('sampleInput threading + precedence', () => {
    it('seeds the Test panel from a live sampleInput, overriding shape.sample', async () => {
      const sampleInput = vi.fn(() => ({ a: 2 }));
      render(
        <JqField
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          shape={RECORD_SHAPE}
          sampleInput={sampleInput}
        />,
      );
      const seed = await readTestSeed();
      expect(seed).toContain('"a": 2');
      expect(seed).not.toContain('"a": 1');
      expect(sampleInput).toHaveBeenCalled();
    });

    it('falls back to shape.sample when the provider returns undefined', async () => {
      render(
        <JqField
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          shape={RECORD_SHAPE}
          sampleInput={() => undefined}
        />,
      );
      const seed = await readTestSeed();
      expect(seed).toContain('"a": 1');
    });

    it('falls back to shape.sample when the provider throws (a host seam must not break Test)', async () => {
      render(
        <JqField
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          shape={RECORD_SHAPE}
          sampleInput={() => {
            throw new Error('no live sample available');
          }}
        />,
      );
      const seed = await readTestSeed();
      expect(seed).toContain('"a": 1');
    });
  });

  describe('description + error slots (a11y)', () => {
    it('renders a description wired to the control via aria-describedby', () => {
      render(
        <JqField
          id="expr"
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          description="Runs against each record."
        />,
      );
      const control = screen.getByLabelText('Transform');
      const description = screen.getByText('Runs against each record.');
      expect(description).toHaveAttribute('id', 'expr-description');
      expect(control).toHaveAttribute('aria-describedby', 'expr-description');
      expect(control).not.toHaveAttribute('aria-invalid');
    });

    it('renders an error with role="alert", sets aria-invalid, and links it via aria-describedby', () => {
      render(
        <JqField
          id="expr"
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          error="Must return an object."
        />,
      );
      const control = screen.getByLabelText('Transform');
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Must return an object.');
      expect(alert).toHaveAttribute('id', 'expr-error');
      expect(control).toHaveAttribute('aria-describedby', 'expr-error');
      expect(control).toHaveAttribute('aria-invalid', 'true');
    });

    it('lists both slot ids on aria-describedby when description and error are both present', () => {
      render(
        <JqField
          id="expr"
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          description="Runs against each record."
          error="Must return an object."
        />,
      );
      const control = screen.getByLabelText('Transform');
      expect(control).toHaveAttribute('aria-describedby', 'expr-description expr-error');
      expect(control).toHaveAttribute('aria-invalid', 'true');
    });

    it('wires the multiline textarea branch identically to the single-line input', () => {
      render(
        <JqField
          id="expr"
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          multiline
          description="Runs against each record."
          error="Must return an object."
        />,
      );
      const control = screen.getByLabelText('Transform');
      expect(control.tagName).toBe('TEXTAREA');
      expect(control).toHaveAttribute('aria-describedby', 'expr-description expr-error');
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveAttribute('id', 'expr-error');
    });

    it('gives each door a discernible accessible name carrying the field label', () => {
      render(
        <>
          <JqField label="Condition" value=".a" onChange={vi.fn()} />
          <JqField label="Expr" value=".b" onChange={vi.fn()} readOnly />
        </>,
      );
      expect(
        screen.getByRole('button', { name: 'Open the visual editor for Condition' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open the visual view for Expr' }),
      ).toBeInTheDocument();
    });
  });

  // The open-state notify a host uses to MUTE its global keyboard shortcuts
  // (window-level keydown for undo/redo/save/delete) while the editor is open —
  // a keydown bubbles to `window` even from the editor's focus-trapped modal, so
  // the host must know when to stand down. Every transition must be reported;
  // these drive the REAL dialog so each close route is exercised end-to-end.
  describe('onEditorOpenChange (global-shortcut muting)', () => {
    const openEditor = (): void => {
      fireEvent.click(screen.getByRole('button', { name: /visual editor/i }));
    };

    /** Resolves once the loaded expression has been laid out as canvas nodes and
     *  the Save action is live — the point from which a real Save/close acts. */
    const editorReady = async (): Promise<void> => {
      await waitFor(() => {
        expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(1);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled();
      });
    };

    /** Drives a GENUINE, serialization-changing edit through the real canvas:
     *  selects the loaded logic node and deletes it, so the editor is honestly
     *  dirty and a close routes through the discard-confirm (not a straight
     *  close). This is what keeps the close-route tests honest after the
     *  baseline fix — a freshly-opened valid expression is no longer dirty. */
    const makeDirtyEdit = async (): Promise<void> => {
      const before = document.querySelectorAll('.react-flow__node').length;
      const logicNode = Array.from(document.querySelectorAll('.react-flow__node')).find(
        (node) => !node.className.includes('jqStart'),
      );
      if (!logicNode) throw new Error('expected a non-Start logic node to delete');
      const pane = document.querySelector('.react-flow');
      if (!pane) throw new Error('expected the react-flow pane');
      fireEvent.click(logicNode);
      fireEvent.keyDown(pane, { key: 'Backspace' });
      await waitFor(() => {
        expect(document.querySelectorAll('.react-flow__node').length).toBeLessThan(before);
      });
    };

    it('reports true when the door button opens the editor', () => {
      const onEditorOpenChange = vi.fn();
      render(
        <JqField
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          onEditorOpenChange={onEditorOpenChange}
        />,
      );

      expect(onEditorOpenChange).not.toHaveBeenCalled();
      openEditor();
      expect(onEditorOpenChange).toHaveBeenCalledTimes(1);
      expect(onEditorOpenChange).toHaveBeenLastCalledWith(true);
    });

    it('reports false when a Save closes the editor', async () => {
      const onEditorOpenChange = vi.fn();
      const onChange = vi.fn();
      render(
        <JqField
          label="Transform"
          value=".a"
          onChange={onChange}
          onEditorOpenChange={onEditorOpenChange}
        />,
      );

      openEditor();
      await editorReady();
      fireEvent.click(screen.getByRole('button', { name: /Save/ }));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('.a');
      });
      // Every transition, in order: open then the save-close.
      expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('reports false only after the discard-confirm is accepted on an Escape close', async () => {
      const onEditorOpenChange = vi.fn();
      render(
        <JqField
          label="Transform"
          value=".foo"
          onChange={vi.fn()}
          onEditorOpenChange={onEditorOpenChange}
        />,
      );

      openEditor();
      await editorReady();
      await makeDirtyEdit();
      // A genuinely edited editor guards the close: Escape raises the discard-
      // confirm instead of closing, so no false has fired yet — still open.
      fireEvent.keyDown(document, { key: 'Escape' });
      await screen.findByText('Discard unsaved changes?');
      expect(onEditorOpenChange.mock.calls).toEqual([[true]]);

      // Accepting the discard is the actual close → the false transition fires.
      fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
      await waitFor(() => {
        expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
      });
    });

    it('reports false when Cancel closes an edited editor via the discard-confirm', async () => {
      const onEditorOpenChange = vi.fn();
      render(
        <JqField
          label="Transform"
          value=".foo"
          onChange={vi.fn()}
          onEditorOpenChange={onEditorOpenChange}
        />,
      );

      openEditor();
      await editorReady();
      await makeDirtyEdit();
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      fireEvent.click(await screen.findByRole('button', { name: /Discard/ }));

      await waitFor(() => {
        expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
      });
    });

    it('does not fire on mount and fires exactly once per real transition under StrictMode', () => {
      const onEditorOpenChange = vi.fn();
      render(
        <StrictMode>
          <JqField
            label="Transform"
            value=".a"
            onChange={vi.fn()}
            onEditorOpenChange={onEditorOpenChange}
          />
        </StrictMode>,
      );

      // StrictMode double-invokes mount effects; the net-committed-transition
      // guard means the mount yields no spurious call.
      expect(onEditorOpenChange).not.toHaveBeenCalled();
      openEditor();
      expect(onEditorOpenChange.mock.calls).toEqual([[true]]);
    });

    it('fires false exactly once when the field unmounts while the editor is open', () => {
      const onEditorOpenChange = vi.fn();
      const { unmount } = render(
        <JqField
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          onEditorOpenChange={onEditorOpenChange}
        />,
      );

      openEditor();
      expect(onEditorOpenChange.mock.calls).toEqual([[true]]);

      // Tearing the field down while open is a close for the muting contract —
      // fired once by the unmount cleanup, never duplicated by the transition
      // effect (which has no such cleanup).
      unmount();
      expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
    });
  });
});

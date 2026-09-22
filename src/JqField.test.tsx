/**
 * The drop-in `JqField`: the resting control reflects and edits the value, the
 * "Visual editor" button opens the editor dialog, and a host can substitute the
 * button through `PrimitivesProvider` (the injection seam).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The Test panel preloads the jq WASM runner on open; jsdom has no WASM fetch, so
// stub the runner (the seed path under test needs no evaluation) — mirrors
// JqTestPanel.test.tsx.
vi.mock('./hooks/useJqRunner', () => ({
  useJqRunner: () => ({
    result: null,
    isRunning: false,
    run: vi.fn(),
    fail: vi.fn(),
    clear: vi.fn(),
    preload: vi.fn(),
  }),
}));

import type { JqInputShapeDescriptor } from './declaration';
import { JqField } from './JqField';
import type { AnyButtonProps } from './primitives';
import { PrimitivesProvider } from './primitives';

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

    it('blocks the run when the provider throws instead of falling back to shape.sample', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: /visual editor/i }));
      await waitFor(() => {
        expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(1);
      });
      const testButton = await screen.findByRole('button', { name: /Test/ });
      await waitFor(() => {
        expect(testButton).toBeEnabled();
      });
      fireEvent.click(testButton);

      // The failure is not swallowed into the static skeleton: the input is not
      // seeded with it, and the run is blocked.
      const input = await screen.findByPlaceholderText<HTMLTextAreaElement>(/Sample record JSON/);
      expect(input.value).not.toContain('"a": 1');
      expect(screen.getByRole('button', { name: /Run/ })).toBeDisabled();
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

  // The density variant for dense host rows: the label goes visually-hidden (its
  // accessible name + htmlFor association preserved) and the door collapses to
  // icon-only (its full per-field aria-label preserved). Non-compact rendering is
  // the regression floor — it must stay exactly as it is today.
  describe('compact (density variant)', () => {
    it('visually-hides the label but keeps its accessible name and htmlFor association', () => {
      render(<JqField id="expr" label="Transform" value=".a" onChange={vi.fn()} compact />);
      // Accessible name preserved: the control is still reachable by its label text,
      // and the label→control association survives (label points at the control id).
      const control = screen.getByLabelText('Transform');
      expect(control).toHaveAttribute('id', 'expr');
      const label = document.querySelector('.jqs-field__label')!;
      expect(label).toHaveTextContent('Transform');
      expect(label).toHaveClass('jqs-visually-hidden');
      expect(label.getAttribute('for')).toBe('expr');
      // The field carries the density modifier that tightens the vertical rhythm.
      expect(document.querySelector('.jqs-field')).toHaveClass('jqs-field--compact');
    });

    it('renders the door icon-only while keeping the full per-field aria-label', () => {
      render(<JqField label="Transform" value=".a" onChange={vi.fn()} compact />);
      const door = screen.getByRole('button', {
        name: 'Open the visual editor for Transform',
      });
      // Icon-only: no visible "Visual editor" text label on the button.
      expect(door).not.toHaveTextContent('Visual editor');
      expect(door.querySelector('.jqs-icon')).toBeInTheDocument();
    });

    it('keeps the read-only door aria-label full when icon-only', () => {
      render(<JqField label="Expr" value=".a" onChange={vi.fn()} readOnly compact />);
      const door = screen.getByRole('button', { name: 'Open the visual view for Expr' });
      expect(door).not.toHaveTextContent('Visual view');
    });

    it('non-compact (default) renders the visible label and a text button — the regression floor', () => {
      render(<JqField label="Transform" value=".a" onChange={vi.fn()} />);
      const label = document.querySelector('.jqs-field__label')!;
      expect(label).toHaveTextContent('Transform');
      expect(label).not.toHaveClass('jqs-visually-hidden');
      expect(document.querySelector('.jqs-field')).not.toHaveClass('jqs-field--compact');
      expect(
        screen.getByRole('button', { name: 'Open the visual editor for Transform' }),
      ).toHaveTextContent('Visual editor');
    });
  });

  // Focus return (WCAG 2.4.3): closing the visual editor must land focus back on
  // the door that opened it — never strand it on <body>. The editor and its
  // discard ConfirmDialog both render on the built-in trigger-less Dialog, so the
  // built-in's own opener capture/restore is what carries this (a host that
  // injects its own Dialog owns focus return instead). The STACKED discard route
  // is the sharp case: the confirm and the editor close in one tick, and the
  // confirm's opener lived inside the now-unmounting editor — its restore must
  // no-op so the editor's restore wins and focus lands on the door.
  describe('focus return on close (WCAG 2.4.3)', () => {
    const editorReady = async (): Promise<void> => {
      await waitFor(() => {
        expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(1);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled();
      });
    };

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

    /** jsdom does not focus a button on click, so the door is focused explicitly
     *  before opening — modelling the real interaction that leaves the opener
     *  focused, which is what the editor captures to restore on close. */
    const openEditorFromDoor = (): HTMLElement => {
      const door = screen.getByRole('button', { name: /visual editor/i });
      door.focus();
      fireEvent.click(door);
      return door;
    };

    it('refocuses the door when a clean editor is closed with Escape', async () => {
      render(<JqField label="Transform" value=".a" onChange={vi.fn()} />);
      const door = openEditorFromDoor();
      await editorReady();

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(document.activeElement).toBe(door);
    });

    it('refocuses the door through the stacked discard-confirm (dirty edit → Cancel → Discard)', async () => {
      render(<JqField label="Transform" value=".foo" onChange={vi.fn()} />);
      const door = openEditorFromDoor();
      await editorReady();
      await makeDirtyEdit();

      // A genuinely dirty editor guards the close: Cancel raises the discard-confirm.
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      fireEvent.click(await screen.findByRole('button', { name: /Discard/ }));

      // Both dialogs close in one tick; the confirm's opener is inside the
      // unmounting editor, so only the editor's restore acts — focus lands on the door.
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(document.activeElement).toBe(door);
    });
  });
});

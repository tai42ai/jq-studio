/**
 * The drop-in `JqField`: the resting control reflects and edits the value, the
 * "Visual editor" button opens the editor dialog, and a host can substitute the
 * button through `PrimitivesProvider` (the injection seam).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { JqField } from './JqField';
import { PrimitivesProvider } from './primitives';
import type { AnyButtonProps } from './primitives';

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
});

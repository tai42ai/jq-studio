/**
 * The Load-from-Expression paste path accepts the host's declared variables as
 * valid roots, exactly as the other converter doors do: pasting `$account.tier`
 * loads a flow when `account` is declared and is refused as an undefined
 * variable when it is not. The declared names reach the dialog through the
 * transformer context, not a drilled prop.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoadExpressionDialog } from './LoadExpressionDialog';
import { TransformerProvider } from './TransformerContext';

const renderDialog = (onLoad: () => void, declaredVariables: readonly string[] = []) =>
  render(
    <TransformerProvider declaredVariables={declaredVariables}>
      <LoadExpressionDialog onLoad={onLoad} />
    </TransformerProvider>,
  );

const openDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: /Load/ }));
  return screen.getByRole('dialog');
};

describe('LoadExpressionDialog declared-variable paste', () => {
  it('loads an expression that reads a declared variable', () => {
    const onLoad = vi.fn();
    renderDialog(onLoad, ['account']);
    const dialog = openDialog();

    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: '$account.tier' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Load/ }));

    expect(onLoad).toHaveBeenCalledTimes(1);
    const [nodes] = onLoad.mock.calls[0] as [unknown[], unknown[]];
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('refuses the same expression when the variable is not declared', () => {
    const onLoad = vi.fn();
    renderDialog(onLoad, []);
    const dialog = openDialog();

    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: '$account.tier' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Load/ }));

    expect(onLoad).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(/Reference to undefined variable: \$account/),
    ).toBeInTheDocument();
  });
});

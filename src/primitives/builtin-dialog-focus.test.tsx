/**
 * Focus return (WCAG 2.4.3) for the built-in trigger-less `Dialog`, at the
 * primitives seam. Radix's default `onCloseAutoFocus` restores focus to a null
 * trigger ref, so without the built-in's own capture+restore focus is stranded on
 * `<body>` after close. The refocus behaviour itself is proven end-to-end through
 * the real editor and its stacked discard-confirm in JqField.test.tsx (a bare
 * builtin rendered as a top-level sibling of the modal churns its opener node
 * under jsdom's portal reconciliation, which the representative editor tree does
 * not — so the behaviour is asserted there, where the DOM is stable). This file
 * pins the OTHER half of the contract: a host that injects its own `Dialog`
 * through {@link PrimitivesProvider} is untouched.
 */
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Dialog as DialogSlot, PrimitivesProvider } from './index';
import type { DialogProps } from './types';

describe('built-in Dialog focus return', () => {
  it('leaves a host-injected Dialog untouched — the built-in focus return does not apply', () => {
    // A host owns focus behaviour when it substitutes the Dialog: the injected
    // component renders in place of the built-in, so none of the built-in's
    // opener capture/restore runs.
    const HostDialog = ({ title, children }: DialogProps) => (
      <div data-host-dialog="yes" role="dialog" aria-label={title}>
        {children}
      </div>
    );
    function HostHarness() {
      const [open, setOpen] = useState(true);
      return (
        <PrimitivesProvider primitives={{ Dialog: HostDialog }}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            door
          </button>
          <DialogSlot title="Sheet" open={open} onOpenChange={setOpen}>
            <input aria-label="field" />
          </DialogSlot>
        </PrimitivesProvider>
      );
    }
    render(<HostHarness />);
    // The host component is what renders — the built-in Radix content is absent.
    expect(screen.getByRole('dialog')).toHaveAttribute('data-host-dialog', 'yes');
    expect(document.querySelector('.jqp-dialog')).toBeNull();
  });
});

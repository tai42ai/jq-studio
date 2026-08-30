/**
 * The primitives-injection seam. jq-studio reads its nine UI controls out of a
 * React context whose default is the built-in set; a host wraps the editor in
 * {@link PrimitivesProvider} to substitute its own design-system components for
 * any of them, and anything it omits keeps the built-in.
 *
 * Every call site inside jq-studio imports the WRAPPER components from
 * `./index`, which resolve through {@link usePrimitives} — so a provider swaps the
 * whole editor's controls at once, with no prop drilling.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { builtinPrimitives } from './builtin';
import type { Primitives } from './types';

const PrimitivesContext = createContext<Primitives>(builtinPrimitives);

export interface PrimitivesProviderProps {
  /** Overrides for any subset of the nine primitives; omitted ones stay built-in. */
  readonly primitives: Partial<Primitives>;
  readonly children: ReactNode;
}

/**
 * Substitute host components for jq-studio's built-in primitives. Merges the
 * caller's overrides over the built-ins (and over any enclosing provider), so a
 * host can replace one control or all nine.
 */
export function PrimitivesProvider({ primitives, children }: PrimitivesProviderProps): ReactNode {
  const inherited = useContext(PrimitivesContext);
  const merged = useMemo<Primitives>(
    () => ({ ...inherited, ...primitives }),
    [inherited, primitives],
  );
  return <PrimitivesContext.Provider value={merged}>{children}</PrimitivesContext.Provider>;
}

/** The active primitive registry (built-ins unless a host injected overrides). */
export function usePrimitives(): Primitives {
  return useContext(PrimitivesContext);
}

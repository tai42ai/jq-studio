/**
 * @fileoverview Lookups over the jq function catalog: name/id resolution, arity
 * disambiguation, visible-port selection, and call-type option resolution.
 */

import type { FunctionDef, FunctionParam } from './function-catalog';
import { functionCategories } from './function-catalog';

/** Get all built-in function names (deduplicated) for conflict detection */
export const getBuiltInFunctionNames = (): string[] => {
  const names = new Set<string>();
  for (const category of functionCategories) {
    for (const func of category.functions) {
      names.add(func.name);
    }
  }
  return Array.from(names);
};

/** Find a specific function def by its unique id */
export const getFunctionDefById = (id: string): FunctionDef | null => {
  for (const category of functionCategories) {
    const fn = category.functions.find((f) => f.id === id);
    if (fn) return fn;
  }
  return null;
};

/**
 * Resolves the {@link FunctionDef} a call refers to, tolerating the converter
 * storing the function NAME (e.g. `range`) rather than an arity-suffixed id
 * (`range_2`). A multi-arity builtin registers one def per overload
 * (`range_1` / `range_2` / `range_3`), so matching `f.id` against the stored
 * name resolves nothing and the call renders no param ports at all.
 *
 * Resolution order:
 *   1. exact id — custom defs (id === name) and single-arity builtins;
 *   2. by NAME disambiguated by ARITY (the count of connected positional args):
 *      the overload whose param count equals the arity, else the HIGHEST-arity
 *      overload so a fresh, unconnected call still surfaces ports to wire.
 *
 * @param options - The functions selectable for the call's type.
 * @param selected - The stored `selectedFunction` (an id or a bare name).
 * @param arity - The number of connected positional args.
 */
export const resolveFunctionDef = (
  options: FunctionDef[],
  selected: string | undefined,
  arity: number,
): FunctionDef | null => {
  if (!selected) return null;
  const byId = options.find((f) => f.id === selected);
  if (byId) return byId;
  const byName = options.filter((f) => f.name === selected);
  if (byName.length === 0) return null;
  if (byName.length === 1) return byName[0] ?? null;
  const exact = byName.find((f) => f.params.length === arity);
  if (exact) return exact;
  return byName.reduce((best, f) => (f.params.length > best.params.length ? f : best));
};

/**
 * The params a resolved def should render PORTS for, given the call's ARITY (the
 * count of connected positional args). Required params always show so an unwired
 * call still offers the slots it needs; a trailing OPTIONAL param shows only once
 * the arity reaches it — so a bare `first` (arity 0, its one param optional)
 * renders zero ports, while `first(x)` renders one.
 */
export const visibleParams = (def: FunctionDef | null, arity: number): FunctionParam[] => {
  if (!def) return [];
  const required = def.params.filter((p) => !p.optional).length;
  const count = Math.min(def.params.length, Math.max(required, arity));
  return def.params.slice(0, count);
};

/**
 * Resolves the selectable functions for a call type.
 *
 * Valid call types are `'custom'` — the flow's own `def` declarations — and the
 * ids in the function catalog.
 *
 * @throws {Error} If the call type is not one of those values.
 */
export const getFunctionOptions = (
  callType: string,
  customFunctions: FunctionDef[],
): FunctionDef[] => {
  if (callType === 'custom') return customFunctions;
  const category = functionCategories.find((c) => c.id === callType);
  if (!category) {
    const valid = [...functionCategories.map((c) => c.id), 'custom'].join(', ');
    throw new Error(`Unknown function call type "${callType}". Valid call types: ${valid}.`);
  }
  return category.functions;
};

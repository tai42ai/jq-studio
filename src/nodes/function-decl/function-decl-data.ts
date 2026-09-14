/**
 * Pure reducers over a Define-Function node's parameter-name list — append a
 * fresh `paramN`, drop one by index, or set one's value — kept apart from the
 * node so the list transforms are testable without a canvas.
 */

/** Append a new parameter defaulting to `param{N}` for the next ordinal. */
export const appendParam = (params: string[]): string[] => [
  ...params,
  `param${String(params.length + 1)}`,
];

/** Remove the parameter at `index`. */
export const removeParamAt = (params: string[], index: number): string[] =>
  params.filter((_, i) => i !== index);

/** Set the parameter at `index` to `value`. */
export const setParamAt = (params: string[], index: number, value: string): string[] =>
  params.map((p, i) => (i === index ? value : p));

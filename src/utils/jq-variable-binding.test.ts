// @vitest-environment node
/**
 * The variable binding proven against the real jq WASM runtime: a bound `$name`
 * is reachable anywhere in the expression — including inside `map(...)` /
 * `select(...)` and a `def` body, where `.` is rebound — while `.` itself holds
 * only the data. An undeclared reference raises rather than reading a silent
 * null, and a reserved or malformed name is refused before a run.
 */
import { describe, expect, it } from 'vitest';

import { execJq } from './converters/test-helpers';
import { bindJqVariables, RESERVED_JQ_VARIABLE_NAMES } from './jq-variable-binding';

/** Binds then runs through the real runtime, exactly as the Test panel's worker
 *  path does: the envelope JSON string is parsed and the wrapped program runs
 *  against it. */
const runBound = async (
  expression: string,
  rawData: string,
  variables: Record<string, unknown>,
): Promise<unknown> => {
  const { program, input } = bindJqVariables(expression, rawData, variables);
  return execJq(program, JSON.parse(input));
};

describe('bindJqVariables', () => {
  it('binds a variable readable at the top of the expression', async () => {
    await expect(
      runBound('$account.tier', '{"id":"a-1"}', { account: { tier: 'gold' } }),
    ).resolves.toBe('gold');
  });

  it('keeps `.` the data alone — the envelope is never visible as `.`', async () => {
    await expect(runBound('.', '{"x":1}', { a: 99 })).resolves.toEqual({ x: 1 });
  });

  it('reaches a variable inside map(...), where `.` is rebound to the item', async () => {
    await expect(runBound('map(. * $factor)', '[1,2,3]', { factor: 10 })).resolves.toEqual([
      10, 20, 30,
    ]);
  });

  it('reaches a variable inside select(...), where `.` is rebound to the item', async () => {
    await expect(
      runBound('map(select(.n >= $min))', '[{"n":1},{"n":2},{"n":3}]', { min: 2 }),
    ).resolves.toEqual([{ n: 2 }, { n: 3 }]);
  });

  it('lets a `def` body read a bound variable, called where `.` is the item', async () => {
    await expect(
      runBound('def scale: . * $factor; map(scale)', '[1,2]', { factor: 5 }),
    ).resolves.toEqual([5, 10]);
  });

  it('evaluates an expression ending in a trailing line comment', async () => {
    // The bound program appends the expression with no wrapping paren, so a
    // trailing `#` comment has no `)` after it for the comment to swallow.
    await expect(runBound('.a\n# trailing comment', '{"a":5}', { x: 1 })).resolves.toBe(5);
  });

  it('emits the bindings in sorted-name order for a stable program', () => {
    const { program, input } = bindJqVariables('$b + $a', '1', { b: 2, a: 1 });
    expect(program).toBe('. as $__in | $__in.v.a as $a | $__in.v.b as $b | $__in.d | $b + $a');
    expect(input).toBe('{"v":{"a":1,"b":2},"d":1}');
  });

  it('binds several variables at once', async () => {
    await expect(runBound('{a: $a, b: $b, d: .}', '"data"', { a: 1, b: [2, 3] })).resolves.toEqual({
      a: 1,
      b: [2, 3],
      d: 'data',
    });
  });

  it('raises on a reference to a variable that was not bound', async () => {
    await expect(runBound('$missing', '{}', { present: 1 })).rejects.toThrow();
  });

  it.each(RESERVED_JQ_VARIABLE_NAMES)('refuses the reserved name %s', (name) => {
    expect(() => bindJqVariables('.', '{}', { [name]: 1 })).toThrow(/reserved/);
  });

  it('refuses a name that is not a jq identifier', () => {
    expect(() => bindJqVariables('.', '{}', { 'not a name': 1 })).toThrow(/valid jq variable/);
  });

  it('passes the expression and data through unchanged when no variables are bound', () => {
    expect(bindJqVariables('.a + 1', '{"a":2}', {})).toEqual({
      program: '.a + 1',
      input: '{"a":2}',
    });
  });

  it('splices the data verbatim, so malformed JSON stays the run’s own error', () => {
    // The data is not re-parsed by the binder; a caller’s invalid JSON rides
    // into the envelope and fails at run time, never silently swallowed here.
    const { input } = bindJqVariables('.', '{ not json', { a: 1 });
    expect(input).toBe('{"v":{"a":1},"d":{ not json}');
  });
});

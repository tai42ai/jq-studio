/**
 * Binds named jq variables for the editor's local sample run.
 *
 * jq-web exposes only `json(input, filter)` / `raw(...)` — no named-argument API
 * — so a value cannot be handed to the runtime as `$name` directly. Instead the
 * values ride IN the input as an envelope `{ "v": { <name>: <value>, … }, "d":
 * <the data> }`, and a generated preamble lifts each into a real `$name` before
 * restoring `.` to the data:
 *
 *   . as $__in | $__in.v.<name> as $<name> | … | $__in.d | <expression>
 *
 * The bindings are emitted in sorted-name order, so the same variable set always
 * produces the same program text. The `as` bindings are lexical, so every
 * `$name` is reachable anywhere in the expression — inside `map(...)` /
 * `select(...)` where `.` is rebound too — while `.` holds only the data. The
 * expression is appended directly after `$__in.d | ` with NO wrapping
 * parentheses: `|` is jq's lowest-precedence operator, so the trailing
 * `$__in.d |` already scopes the whole expression to the data, and an inner
 * `(…)` would put a `)` after a trailing line comment (`.a\n# …`), where the
 * comment swallows it. A reference to a name that was not bound is a jq compile
 * error, surfaced loudly by the run rather than read as a silent null.
 *
 * The names `$__in` (the envelope binding) and jq's own `$ENV` / `$__loc__` may
 * not be taken by a declared variable; binding one raises.
 */

import { VALID_NAME_PATTERN } from '../enums';

/** The jq variable names a declared variable may not take: the envelope's own
 *  `$__in`, and jq's built-in `$ENV` / `$__loc__`. */
export const RESERVED_JQ_VARIABLE_NAMES: readonly string[] = ['__in', 'ENV', '__loc__'];

/**
 * Asserts `name` may be bound as a jq `$`-variable: not a reserved name and a
 * valid jq identifier. The single naming rule shared by the binder here and the
 * sample resolver that prepares the run's bindings, so a bad declared name is
 * rejected identically wherever it enters.
 *
 * @throws {Error} when the name is reserved or not a jq identifier.
 */
export function assertJqVariableName(name: string): void {
  if (RESERVED_JQ_VARIABLE_NAMES.includes(name)) {
    throw new Error(`"$${name}" is a reserved jq variable name and cannot be bound.`);
  }
  if (!VALID_NAME_PATTERN.test(name)) {
    throw new Error(`"${name}" is not a valid jq variable name.`);
  }
}

/** A program bound to run against its variable-carrying envelope. */
export interface BoundJqProgram {
  /** The program to run: the binding preamble followed by the expression (or the
   *  expression unchanged when no variables are bound). */
  readonly program: string;
  /** The JSON input STRING to run it against: the envelope `{"v":…,"d":…}` (or
   *  the data unchanged when no variables are bound). */
  readonly input: string;
}

/**
 * Binds `variables` as jq `$name`s for a run of `expression` over `rawData`.
 *
 * `rawData` is spliced into the envelope verbatim (never re-parsed here), so a
 * caller's malformed JSON surfaces as the run's own "invalid JSON" rather than
 * being masked. With no variables the expression and data pass through
 * unchanged, keeping a plain field's run — and its error output — exactly as it
 * is without variables.
 *
 * @throws {Error} when a variable name is reserved or not a jq identifier.
 */
export function bindJqVariables(
  expression: string,
  rawData: string,
  variables: Record<string, unknown>,
): BoundJqProgram {
  const names = Object.keys(variables).sort();
  for (const name of names) {
    assertJqVariableName(name);
  }

  if (names.length === 0) {
    return { program: expression, input: rawData };
  }

  const bindings = names.map((name) => `$__in.v.${name} as $${name}`);
  const preamble = ['. as $__in', ...bindings, '$__in.d'].join(' | ');
  const program = `${preamble} | ${expression}`;
  const envelope = Object.fromEntries(names.map((name) => [name, variables[name]]));
  const input = `{"v":${JSON.stringify(envelope)},"d":${rawData}}`;
  return { program, input };
}

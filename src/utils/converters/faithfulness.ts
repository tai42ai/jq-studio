/**
 * @fileoverview The faithfulness oracle: proves whether two jq programs behave
 * the SAME by running both and comparing outputs, rather than comparing text.
 *
 * The visual editor round-trips jq through a node graph (text → graph → text).
 * A parser bug can produce a graph that serialises back to DIFFERENT jq, which
 * — saved silently over the field — corrupts the expression. This module is the
 * shared judge both the classification test and the runtime guard use to catch
 * that: it compiles the two programs against a battery of sample inputs and
 * compares their outputs semantically. It never decides from the text alone, so
 * a harmless reformat (added parens, reordered whitespace) reads as faithful and
 * only a real behaviour change reads as a corruption.
 *
 * The executor is injected so the same logic runs under the test's node-hosted
 * WASM and the browser's lazily-loaded WASM without either importing the other.
 *
 * TIMEOUTS. When the executor is the worker-backed one (the browser guard), an
 * input that does not terminate is stopped at its deadline and the executor throws
 * a {@link JqTimeoutError}. That is NOT a jq error: two programs that both ERROR on
 * an input agree there, but a timeout is "we could not decide", which must never
 * read as agreement. So a timeout is a THIRD outcome that agrees with nothing —
 * including another timeout — keeping the oracle honest and unfaithful-safe.
 */
import { JqTimeoutError } from '../jq-worker-client';

/**
 * A jq executor: compiles and runs `program` against `input`, resolving to the
 * program's single output (or rejecting on a jq error). The oracle wraps every
 * program itself (see {@link wrapProgram}), so implementations pass `program`
 * through to jq unchanged.
 */
export type JqExecutor = (program: string, input: unknown) => Promise<unknown>;

/** The verdict for one text-vs-text comparison. */
export type FaithfulnessVerdict =
  | 'faithful' // proven to behave identically across every sample input
  | 'unfaithful' // proven to differ on at least one sample input
  | 'unknown'; // the oracle could not run (e.g. the WASM runtime is unavailable)

/**
 * The battery of sample inputs the oracle runs both programs against. It spans
 * the JSON value space a jq field meets — nulls, booleans, numbers (including
 * zero and negatives), strings (including empty), arrays (including empty and
 * mixed), objects (including empty), and a deep object carrying field names
 * real-world expressions read — so a behaviour difference has many chances
 * to show. Frozen so a caller cannot mutate the shared battery.
 */
export const FAITHFULNESS_SAMPLE_INPUTS: readonly unknown[] = Object.freeze([
  null,
  true,
  false,
  0,
  42,
  -7,
  3.5,
  '',
  'hello world',
  [],
  [1, 2, 3],
  ['a', 'b', 'c'],
  [3, 1, 2, 1, 5],
  {},
  { a: 1, b: 2 },
  { a: { b: { c: 1 } }, items: [{ name: 'z', score: 2, active: true }], users: [] },
  {
    name: 'Bob',
    age: 30,
    active: true,
    value: 7,
    x: 2,
    y: 5,
    type: 'user',
    data: { nested: 1 },
    a: null,
    b: [1, 2],
    config: { host: 'h', port: 443, name: 'svc' },
    items: [
      { name: 'a', score: 90, status: 'open', active: true, amount: 3 },
      { name: 'b', score: 40, status: 'closed', active: false, amount: 5 },
    ],
    scores: [10, 55, 99],
    result: { one: 1, two: null, three: 3 },
    s: 'abc',
    children: [],
  },
]);

/**
 * The per-input output limit the oracle collects. jq expressions can produce an
 * unbounded stream (e.g. `recurse`), which would run the WASM runtime out of
 * memory; bounding the collection keeps every comparison fast and finite while
 * staying far above the handful of outputs a real field expression yields.
 */
const OUTPUT_LIMIT = 4096;

/**
 * Wraps a program so its full output stream is collected into ONE comparable,
 * bounded value.
 *
 * `jq`'s runtime collapses a multi-output stream ambiguously (one output comes
 * back bare, many come back as an array indistinguishable from a single array
 * output), so wrapping in `[ … ]` makes the stream explicit and unambiguous.
 * `limit` caps an otherwise unbounded stream so a non-terminating generator
 * cannot hang or crash the runtime.
 */
function wrapProgram(program: string): string {
  return `[ limit(${String(OUTPUT_LIMIT)}; ${program}) ]`;
}

/** The outcome of running one wrapped program against one input. */
type SampleOutcome =
  | { readonly kind: 'ok'; readonly json: string }
  | { readonly kind: 'error' }
  | { readonly kind: 'timeout' };

async function runSample(
  exec: JqExecutor,
  program: string,
  input: unknown,
): Promise<SampleOutcome> {
  try {
    const output = await exec(wrapProgram(program), input);
    return { kind: 'ok', json: JSON.stringify(output) };
  } catch (err) {
    // A deadline timeout is NOT an observable jq behaviour — it is the oracle
    // giving up on this input, so it must never be counted as agreement (not even
    // with another timeout). Every OTHER throw is a jq runtime error, which IS
    // observable: two programs that both error on an input agree there.
    if (err instanceof JqTimeoutError) return { kind: 'timeout' };
    return { kind: 'error' };
  }
}

function outcomesAgree(a: SampleOutcome, b: SampleOutcome): boolean {
  // A timeout on either side is undecidable: never agreement.
  if (a.kind === 'timeout' || b.kind === 'timeout') return false;
  if (a.kind === 'error' || b.kind === 'error') return a.kind === b.kind;
  return a.json === b.json;
}

/**
 * Judges whether two jq programs behave identically across the sample battery.
 *
 * Returns `unfaithful` on the FIRST input where their outputs (or their
 * error/no-error status) differ, `faithful` when every input agrees. Two
 * programs that error identically on an input agree there — matching jq's own
 * behaviour, where the error is the result.
 *
 * @param exprA - The first program (typically the original text)
 * @param exprB - The second program (typically the round-tripped text)
 * @param exec - The jq executor to run both programs through
 * @param inputs - The inputs to compare over (defaults to the shared battery)
 * @returns `faithful` or `unfaithful` (never `unknown`; the caller owns the
 *   runtime-unavailable case, since it owns the executor)
 */
export async function compareJqSemantics(
  exprA: string,
  exprB: string,
  exec: JqExecutor,
  inputs: readonly unknown[] = FAITHFULNESS_SAMPLE_INPUTS,
): Promise<Exclude<FaithfulnessVerdict, 'unknown'>> {
  for (const input of inputs) {
    const [a, b] = await Promise.all([
      runSample(exec, exprA, input),
      runSample(exec, exprB, input),
    ]);
    if (!outcomesAgree(a, b)) return 'unfaithful';
  }
  return 'faithful';
}

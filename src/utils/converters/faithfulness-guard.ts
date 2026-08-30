/**
 * @fileoverview The runtime faithfulness GUARD for the visual jq editor.
 *
 * The editor round-trips jq through a node graph. A parser bug can produce a
 * graph that serialises back to DIFFERENT jq — saved silently over the field,
 * that corrupts the expression. This guard is the structural defence: BEFORE a
 * parsed graph is shown for editing, it serialises the graph back and asks the
 * WASM oracle whether the two texts behave the same. A graph that does not is
 * treated exactly like one the editor cannot draw — the surface shows the
 * neutral "edit as text" notice and never adopts (nor lets the user save) the
 * mis-read graph. This holds no matter what parser bug produced the mismatch.
 *
 * The verdict is memoised per expression: the graph is a deterministic function
 * of the text, so one check per distinct expression suffices for the lifetime of
 * the tab, and repeated renders of the same field pay nothing.
 */
import { convertJQToFlow } from './flow-from-jq';
import { convertFlowToJQ } from './jq-from-flow';
import { compareJqSemantics, type JqExecutor } from './faithfulness';
import { runJqValueViaWorker } from '../jq-worker-client';

/**
 * The oracle executor: the worker-backed runner with a per-input deadline. Off the
 * main thread a runaway sample input is terminated at its deadline and surfaces as
 * a {@link JqTimeoutError}, which the oracle treats as unfaithful-safe — so the
 * per-keystroke guard can never freeze the tab on a pathological expression. When
 * no worker is available (before `installDefaultJqWorker` runs, and in tests) this transparently
 * falls back to synchronous main-thread evaluation, i.e. today's behaviour.
 */
const oracleExecutor: JqExecutor = (program, input) => runJqValueViaWorker(program, input);

/**
 * The standing of an expression against the visual editor's round-trip:
 * - `faithful` — the graph serialises back to behaviour-identical jq (safe to edit)
 * - `unfaithful` — the graph serialises back to DIFFERENT jq (must fall back to text)
 * - `unparseable` — the converter cannot build a graph at all (a separate concern
 *   the surface already handles; never a corruption risk since there is no graph)
 */
export type RoundTripVerdict = 'faithful' | 'unfaithful' | 'unparseable';

const verdictCache = new Map<string, RoundTripVerdict>();

async function computeVerdict(expression: string): Promise<RoundTripVerdict> {
  if (!expression.trim()) return 'faithful';

  let regenerated: string;
  try {
    const { nodes, edges } = convertJQToFlow(expression);
    regenerated = convertFlowToJQ(nodes, edges);
  } catch {
    // No graph was built — nothing to save over the text, so no corruption path.
    return 'unparseable';
  }

  // A graph that serialises back to the same text is trivially faithful; only a
  // reformat needs the oracle. This shortcut also keeps a runtime-unavailable
  // environment from downgrading an obviously-safe identity round-trip.
  if (regenerated === expression) return 'faithful';

  // The oracle treats a runtime it cannot reach as "both programs error the same
  // way", which reads as faithful — a deliberate fail-open so a momentary WASM
  // outage never blocks editing (the parser's own fixes keep known constructs
  // safe without it). A per-input DEADLINE is the one exception: a runaway sample
  // times out and reads as unfaithful (fail-closed), so the guard falls back to
  // text rather than adopting a graph it cannot prove.
  return compareJqSemantics(expression, regenerated, oracleExecutor);
}

/**
 * Returns whether the visual editor's reading of `expression` is faithful,
 * memoised per expression.
 *
 * @param expression - The original jq text the editor would load
 * @returns The round-trip verdict for that text
 */
export async function roundTripVerdict(expression: string): Promise<RoundTripVerdict> {
  const cached = verdictCache.get(expression);
  if (cached !== undefined) return cached;
  const verdict = await computeVerdict(expression);
  verdictCache.set(expression, verdict);
  return verdict;
}

/** Clears the memoised verdicts. Exposed for tests that swap the oracle runtime. */
export function clearRoundTripVerdictCache(): void {
  verdictCache.clear();
}

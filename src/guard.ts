/**
 * jq-studio's faithfulness + validity API — the public face of the round-trip
 * guard that keeps the visual editor from ever adopting (or saving over) an
 * expression it reads WRONG.
 *
 * Two independent questions live here:
 *  - VALIDITY (`checkJqValidity`): does the jq compile at all? (a WASM concern)
 *  - FAITHFULNESS (`roundTripVerdict` / `canRepresentFaithfully`): does the
 *    graph the editor would build serialise back to behaviour-identical jq?
 *
 * Both are memoised, so a host can call them per keystroke cheaply.
 */
export type { RoundTripVerdict } from './utils/converters/faithfulness-guard';
export {
  clearRoundTripVerdictCache,
  roundTripVerdict,
} from './utils/converters/faithfulness-guard';
export type { JqValidity } from './utils/jq-loader';
export { checkJqValidity } from './utils/jq-loader';

import { roundTripVerdict } from './utils/converters/faithfulness-guard';

/**
 * A cheap, memoised check: can the visual editor represent `text` faithfully
 * (round-trip it to behaviour-identical jq)? A host uses this to decide whether
 * the visual door is the sensible default for a field — e.g. defaulting the
 * field editor to the Editor tab only when the current expression both parses
 * AND passes this guard. Memoisation is inherited from `roundTripVerdict`,
 * so repeated calls for the same text pay nothing.
 *
 * `declaredVariables` names (without `$`) the variables the host binds beside
 * `.` for the field; each is accepted as a valid path root, so an expression
 * that reads one still round-trips through the visual editor.
 */
export async function canRepresentFaithfully(
  text: string,
  declaredVariables: readonly string[] = [],
): Promise<boolean> {
  return (await roundTripVerdict(text, declaredVariables)) === 'faithful';
}

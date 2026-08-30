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
export {
  roundTripVerdict,
  clearRoundTripVerdictCache,
} from './utils/converters/faithfulness-guard';
export type { RoundTripVerdict } from './utils/converters/faithfulness-guard';
export { checkJqValidity } from './utils/jq-loader';
export type { JqValidity } from './utils/jq-loader';

import { roundTripVerdict } from './utils/converters/faithfulness-guard';

/**
 * A cheap, memoised check: can the visual editor represent `text` faithfully
 * (round-trip it to behaviour-identical jq)? A host uses this to decide whether
 * the visual door is the sensible default for a field — e.g. defaulting the
 * field editor to the Editor tab only when the current expression both parses
 * AND passes this guard (F4). Memoisation is inherited from `roundTripVerdict`,
 * so repeated calls for the same text pay nothing.
 */
export async function canRepresentFaithfully(text: string): Promise<boolean> {
  return (await roundTripVerdict(text)) === 'faithful';
}

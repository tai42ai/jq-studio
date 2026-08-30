// @vitest-environment node
/**
 * @fileoverview The corpus faithfulness classification — the mission's headline
 * guarantee, run as a test.
 *
 * `jq-corpus.json` is a deduped, source-tagged battery of real and generated jq:
 * every jq string drawn from real flow-authoring presets, the repo's seed
 * expressions and converter fixtures, plus a generated construct matrix. Each
 * expression is pushed through the FULL round-trip (text → graph → text) and the
 * two texts are compared for behaviour by the faithfulness oracle over the real
 * jq WASM runtime.
 *
 * The contract is absolute: every entry must be either CLEAN (parses AND reads
 * back to behaviour-identical jq) or PARSE-FAIL (the converter honestly refuses
 * it). ZERO entries may be CORRUPT — parse into a graph that serialises back to
 * different-behaving jq. A new corruption anywhere the corpus reaches fails here.
 *
 * `jq-corpus.verdicts.json` is the committed gap table (construct → verdict); the
 * test both asserts it holds and (with `GEN_CORPUS_VERDICTS=1`) regenerates it.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from '../flow-from-jq';
import { convertFlowToJQ } from '../jq-from-flow';
import { compareJqSemantics } from '../faithfulness';
import { execJq } from '../test-helpers';

interface CorpusEntry {
  expr: string;
  source: string;
}

type Verdict = 'clean' | 'parse-fail';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(here, 'jq-corpus.json'), 'utf8')) as CorpusEntry[];

/**
 * Classifies one expression. Returns `parse-fail` when the converter refuses it,
 * `clean` when it round-trips faithfully, or throws with a diagnostic when it is
 * CORRUPT (round-trips to different-behaving jq) — the condition the suite bans.
 */
async function classify(expr: string): Promise<Verdict> {
  let regenerated: string;
  try {
    const { nodes, edges } = convertJQToFlow(expr);
    regenerated = convertFlowToJQ(nodes, edges);
  } catch {
    return 'parse-fail';
  }
  const verdict = await compareJqSemantics(expr, regenerated, execJq);
  if (verdict === 'unfaithful') {
    throw new Error(`CORRUPT round-trip:\n  in:  ${expr}\n  out: ${regenerated}`);
  }
  return 'clean';
}

describe('jq corpus: no expression round-trips to different-behaving jq', () => {
  const liveVerdicts: Record<string, Verdict> = {};

  for (const entry of corpus) {
    it(`[${entry.source}] ${entry.expr.slice(0, 72)}`, async () => {
      liveVerdicts[entry.expr] = await classify(entry.expr);
    });
  }

  it('matches the committed gap table (construct → verdict)', () => {
    const path = join(here, 'jq-corpus.verdicts.json');
    if (process.env.GEN_CORPUS_VERDICTS) {
      writeFileSync(path, JSON.stringify(liveVerdicts, null, 2) + '\n');
    }
    const committed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Verdict>;
    // Every corpus entry has a committed verdict, and the live run agrees with it.
    for (const entry of corpus) {
      expect(liveVerdicts[entry.expr], entry.expr).toBe(committed[entry.expr]);
    }
    // And the table carries exactly the corpus's expressions (no stale keys).
    expect(new Set(Object.keys(committed))).toEqual(new Set(corpus.map((e) => e.expr)));
  });
});

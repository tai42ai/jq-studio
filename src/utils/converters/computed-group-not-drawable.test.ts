// @vitest-environment node
/**
 * Pins a class of expression that is VALID jq and RUNS, but that the visual
 * converter deliberately refuses: its shape, `(… // {})["identity"] // []`,
 * bracket-indexes a computed group as an operator operand — a construct the node
 * graph has no faithful drawing for.
 *
 * The round-trip corruption is real, so this is left as "outside the visual
 * language" rather than force-parsed: the editor must fall back to the neutral
 * "runs normally — edit as text" notice, never render a wrong graph.
 */
import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './flow-from-jq';
import { execJq } from './test-helpers';

const NOT_DRAWABLE_CONDITION =
  '((((((.states.record.todo // {})["identity"] // []) | map(select(.status == "open")) | map(. + {kind: "identity"}))) | length > 0) or (((.states.record.identity.subject_uuid // null) != null) | not))';

const NOT_DRAWABLE_EXPR =
  '{step_kwargs: {channel: .step_kwargs.channel, sender: .step_kwargs.sender, message: .step_kwargs.message, items: ((((.states.record.todo // {})["identity"] // []) | map(select(.status == "open")) | map(. + {kind: "identity"})))}}';

const STATE_WITH_OPEN_IDENTITY = {
  step_kwargs: { channel: 'webhook', sender: 's', message: 'hi' },
  states: {
    record: {
      todo: { identity: [{ status: 'open', name: 'Ada' }] },
      identity: {},
    },
  },
};

describe('computed-group indexing (case c: valid jq, not drawable)', () => {
  it('the branch condition is valid jq and runs to a boolean', async () => {
    await expect(execJq(NOT_DRAWABLE_CONDITION, STATE_WITH_OPEN_IDENTITY)).resolves.toBe(true);
  });

  it('the runnable expr is valid jq and runs to the collected items', async () => {
    const out = await execJq(NOT_DRAWABLE_EXPR, STATE_WITH_OPEN_IDENTITY);
    expect(out).toEqual({
      step_kwargs: {
        channel: 'webhook',
        sender: 's',
        message: 'hi',
        items: [{ status: 'open', name: 'Ada', kind: 'identity' }],
      },
    });
  });

  it('the visual converter cannot draw either, so the editor must fall back', () => {
    expect(() => convertJQToFlow(NOT_DRAWABLE_CONDITION)).toThrow(/Unable to parse jq expression/);
    expect(() => convertJQToFlow(NOT_DRAWABLE_EXPR)).toThrow(/Unable to parse jq expression/);
  });
});

// @vitest-environment node
/**
 * A variable the host declares beside `.` is a valid path root: the
 * converter draws a reference to it instead of throwing, it round-trips back to
 * the same text (postfix path included), and a reference to a variable that is
 * neither assigned nor declared still raises.
 */
import { describe, expect, it } from 'vitest';

import { JQNodeType, ValueType } from '../../enums';
import type { JQValueData } from '../../types';
import { convertJQToFlow } from './flow-from-jq';
import { convertFlowToJQ } from './jq-from-flow';

const valueNodes = (nodes: { data: { type: JQNodeType } }[]) =>
  nodes.filter((n) => n.data.type === JQNodeType.Value) as unknown as { data: JQValueData }[];

describe('declared variables as path roots', () => {
  it('draws a bare declared variable reference and round-trips it', () => {
    const { nodes, edges } = convertJQToFlow('$parked', ['parked']);
    const values = valueNodes(nodes);
    expect(values).toHaveLength(1);
    expect(values[0]!.data.valueType).toBe(ValueType.Path);
    expect(values[0]!.data.pathValue).toBe('$parked');
    expect(convertFlowToJQ(nodes, edges)).toBe('$parked');
  });

  it('composes a postfix path onto a declared variable root and round-trips it', () => {
    const { nodes, edges } = convertJQToFlow('$parked.ids | length', ['parked']);
    // The pipe may serialise across lines; the root and its postfix path are what
    // must survive, in order.
    expect(convertFlowToJQ(nodes, edges)).toMatch(/^\$parked\.ids\s*\|\s*length$/);
  });

  it('accepts a declared variable read inside a rebinding context', () => {
    const { nodes, edges } = convertJQToFlow('map(. + $offset)', ['offset']);
    // The reference survives the round-trip rather than being dropped or renamed.
    expect(convertFlowToJQ(nodes, edges)).toContain('$offset');
  });

  it('still raises for a variable that is neither assigned nor declared', () => {
    expect(() => convertJQToFlow('$missing', ['parked'])).toThrow(
      'Reference to undefined variable: $missing',
    );
  });

  it('raises for any variable reference when nothing is declared or assigned', () => {
    expect(() => convertJQToFlow('$parked')).toThrow('Reference to undefined variable: $parked');
  });
});

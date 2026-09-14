/**
 * @fileoverview Tests for the connection rule predicates that the readers do not
 * exercise on their own — chiefly the single-output fan-out rule.
 */

import { describe, it, expect } from 'vitest';
import { allowsMultipleFromSource } from './connection-rules';
import { JQNodeType, JQHandleIdPrefix } from '../enums';

describe('allowsMultipleFromSource', () => {
  it('allows fan-out only from the Start node functions handle', () => {
    expect(allowsMultipleFromSource(JQNodeType.Start, JQHandleIdPrefix.Functions)).toBe(true);
  });

  it('rejects fan-out from the Start node flow handle', () => {
    expect(allowsMultipleFromSource(JQNodeType.Start, JQHandleIdPrefix.Flow)).toBe(false);
  });

  it('rejects fan-out from a non-Start node on the functions handle', () => {
    expect(allowsMultipleFromSource(JQNodeType.Value, JQHandleIdPrefix.Functions)).toBe(false);
  });

  it('rejects fan-out for a null handle', () => {
    expect(allowsMultipleFromSource(JQNodeType.Start, null)).toBe(false);
  });
});

/**
 * @fileoverview Shared node-name checks: the reserved-name set (jq built-ins
 * plus keywords) and a flag verdict for a single name against its siblings.
 */

import { JQ_RESERVED_KEYWORDS, VALID_NAME_PATTERN } from '../enums';
import { getBuiltInFunctionNames } from './function-resolver';

/** The names a node or parameter may not take: every jq built-in plus keyword. */
export const buildReservedNames = (): string[] => [
  ...getBuiltInFunctionNames(),
  ...JQ_RESERVED_KEYWORDS,
];

export interface NameVerdict {
  /** No name was given. */
  empty: boolean;
  /** The name is a valid variable identifier (always true when empty). */
  valid: boolean;
  /** The name collides with a reserved name (always false when empty). */
  reserved: boolean;
  /** No sibling shares the name (always true when empty). */
  unique: boolean;
}

/**
 * Classifies a name against the identifier rule, the reserved set, and its
 * siblings, as independent flags — callers pick which apply and phrase the
 * message. An empty name reports `valid`/`unique` and not `reserved`, matching
 * fields where a name is optional.
 */
export const nameVerdict = (name: string, siblings: string[], reserved: string[]): NameVerdict => {
  const empty = name.length === 0;
  return {
    empty,
    valid: empty || VALID_NAME_PATTERN.test(name),
    reserved: !empty && reserved.includes(name),
    unique: empty || !siblings.includes(name),
  };
};

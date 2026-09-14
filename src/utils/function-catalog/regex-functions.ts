/**
 * @fileoverview jq regular-expression built-ins (test, match, sub, gsub).
 */

import type { FunctionDef } from './types';

export const regexFunctions: FunctionDef[] = [
  {
    id: 'test',
    name: 'test',
    description: 'Tests if the input string matches the regex.',
    params: [{ name: 'regex', description: 'Regex pattern' }],
  },
  {
    id: 'match',
    name: 'match',
    description: 'Returns match object(s) for the regex in the input string.',
    params: [{ name: 'regex', description: 'Regex pattern' }],
  },
  {
    id: 'sub',
    name: 'sub',
    description: 'Substitutes the first match of regex with replacement.',
    params: [
      { name: 'regex', description: 'Regex pattern' },
      { name: 'replacement', description: 'Replacement string' },
    ],
  },
  {
    id: 'gsub',
    name: 'gsub',
    description: 'Substitutes all matches of regex with replacement.',
    params: [
      { name: 'regex', description: 'Regex pattern' },
      { name: 'replacement', description: 'Replacement string' },
    ],
  },
];

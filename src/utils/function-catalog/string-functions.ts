/**
 * @fileoverview jq string built-ins (split, join, prefix/suffix and case tests).
 */

import type { FunctionDef } from './types';

export const stringFunctions: FunctionDef[] = [
  {
    id: 'split',
    name: 'split',
    description: 'Splits a string on the separator.',
    params: [{ name: 'separator', description: 'Separator string' }],
  },
  {
    id: 'join',
    name: 'join',
    description: 'Joins an array of strings with the separator.',
    params: [{ name: 'separator', description: 'Separator string' }],
  },
  {
    id: 'startswith',
    name: 'startswith',
    description: 'Returns true if input starts with the string.',
    params: [{ name: 'string', description: 'String to check' }],
  },
  {
    id: 'endswith',
    name: 'endswith',
    description: 'Returns true if input ends with the string.',
    params: [{ name: 'string', description: 'String to check' }],
  },
  {
    id: 'contains',
    name: 'contains',
    description: 'Returns true if the input contains the value.',
    params: [{ name: 'value', description: 'Value to check' }],
  },
  {
    id: 'ascii_downcase',
    name: 'ascii_downcase',
    description: 'Converts string to lower case.',
    params: [],
  },
  {
    id: 'ascii_upcase',
    name: 'ascii_upcase',
    description: 'Converts string to upper case.',
    params: [],
  },
];

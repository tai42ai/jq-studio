/**
 * @fileoverview jq numeric built-ins (floor, sqrt, pow, min, max).
 */

import type { FunctionDef } from './types';

export const mathFunctions: FunctionDef[] = [
  { id: 'floor', name: 'floor', description: 'Returns the floor of the number.', params: [] },
  {
    id: 'sqrt',
    name: 'sqrt',
    description: 'Returns the square root of the number.',
    params: [],
  },
  {
    id: 'pow',
    name: 'pow',
    description: 'Returns base raised to the power of exponent.',
    params: [
      { name: 'base', description: 'Base number' },
      { name: 'exponent', description: 'Exponent' },
    ],
  },
  {
    id: 'min',
    name: 'min',
    description: 'Returns the minimum element in an array.',
    params: [],
  },
  {
    id: 'max',
    name: 'max',
    description: 'Returns the maximum element in an array.',
    params: [],
  },
];

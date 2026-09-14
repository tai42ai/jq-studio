/**
 * @fileoverview jq debugging built-ins (debug, stderr).
 */

import type { FunctionDef } from './types';

export const debugFunctions: FunctionDef[] = [
  {
    id: 'debug',
    name: 'debug',
    description: 'Prints the input value to stderr for debugging, then passes it through.',
    params: [],
  },
  { id: 'stderr', name: 'stderr', description: 'Prints the input to stderr.', params: [] },
];

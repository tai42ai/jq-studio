/**
 * @fileoverview The jq built-in function catalog: one `'builtin'` category
 * assembled from the per-concern function groups.
 */

import { dateFunctions } from './date-functions';
import { debugFunctions } from './debug-functions';
import { iteratorFunctions } from './iterator-functions';
import { mathFunctions } from './math-functions';
import { regexFunctions } from './regex-functions';
import { stringFunctions } from './string-functions';
import { transformationFunctions } from './transformation-functions';
import type { FunctionCategory } from './types';

export type { FunctionCategory, FunctionDef, FunctionParam } from './types';

// The picker dropdown lists builtins in this array's order, so the sequence is
// part of the observable surface. jq's own builtin listing puts the split/join
// string ops ahead of the regex ops and the remaining (case/search) string ops
// after them, so the string group is emitted around the regex group.
const joinIndex = stringFunctions.findIndex((f) => f.id === 'join');
const leadingStringFunctions = stringFunctions.slice(0, joinIndex + 1);
const trailingStringFunctions = stringFunctions.slice(joinIndex + 1);

export const functionCategories: FunctionCategory[] = [
  {
    id: 'builtin',
    label: 'Built-in Functions',
    description: 'All jq built-in functions for data transformation, iteration, and manipulation.',
    functions: [
      ...iteratorFunctions,
      ...transformationFunctions,
      ...leadingStringFunctions,
      ...regexFunctions,
      ...trailingStringFunctions,
      ...dateFunctions,
      ...mathFunctions,
      ...debugFunctions,
    ],
  },
];

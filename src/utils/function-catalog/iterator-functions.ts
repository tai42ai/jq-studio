/**
 * @fileoverview jq iterator and stream built-ins (map, range, sort, and peers).
 */

import type { FunctionDef } from './types';

export const iteratorFunctions: FunctionDef[] = [
  {
    id: 'map',
    name: 'map',
    description:
      'Applies the filter to each element of the input array and returns the results as a new array.',
    params: [{ name: 'filter', description: 'Filter to apply' }],
  },
  {
    id: 'map_values',
    name: 'map_values',
    description:
      'Applies the filter to each value of the input object and returns the object with updated values.',
    params: [{ name: 'filter', description: 'Filter to apply' }],
  },
  {
    id: 'select',
    name: 'select',
    description:
      'Produces the input unchanged if the condition returns true; otherwise, produces no output.',
    params: [{ name: 'condition', description: 'Condition to evaluate' }],
  },
  {
    id: 'range_1',
    name: 'range',
    description:
      'Generates a sequence of numbers from 0 up to (but not including) the given number.',
    params: [{ name: 'upto', description: 'Upper bound (exclusive)' }],
  },
  {
    id: 'range_2',
    name: 'range',
    description: "Generates a sequence of numbers from 'from' up to (but not including) 'upto'.",
    params: [
      { name: 'from', description: 'Start value' },
      { name: 'upto', description: 'Upper bound (exclusive)' },
    ],
  },
  {
    id: 'range_3',
    name: 'range',
    description:
      "Generates a sequence of numbers starting at 'from', incrementing by 'by', up to 'upto'.",
    params: [
      { name: 'from', description: 'Start value' },
      { name: 'upto', description: 'Upper bound (exclusive)' },
      { name: 'by', description: 'Step increment' },
    ],
  },
  {
    id: 'recurse_1',
    name: 'recurse',
    description:
      'Recursively applies the filter to the input, producing a stream of all intermediate results.',
    params: [{ name: 'filter', description: 'Filter to apply recursively' }],
  },
  {
    id: 'recurse_2',
    name: 'recurse',
    description: 'Recursively applies the filter while the condition is met.',
    params: [
      { name: 'filter', description: 'Filter to apply' },
      { name: 'condition', description: 'Condition to continue' },
    ],
  },
  {
    id: 'while',
    name: 'while',
    description:
      'Repeatedly applies the update filter to the input as long as the condition is true.',
    params: [
      { name: 'condition', description: 'Condition to check' },
      { name: 'update', description: 'Update filter' },
    ],
  },
  {
    id: 'until',
    name: 'until',
    description: 'Applies the update filter to the input until the condition becomes true.',
    params: [
      { name: 'condition', description: 'Condition to check' },
      { name: 'update', description: 'Update filter' },
    ],
  },
  {
    id: 'repeat',
    name: 'repeat',
    description: 'Indefinitely outputs the values produced by the filter.',
    params: [{ name: 'filter', description: 'Filter to repeat' }],
  },
  {
    id: 'inputs',
    name: 'inputs',
    description: 'Outputs all remaining inputs from the input stream one by one.',
    params: [],
  },
  {
    id: 'path',
    name: 'path',
    description: 'Outputs array representations of the given path expression.',
    params: [{ name: 'path_expression', description: 'Path expression' }],
  },
  {
    id: 'paths',
    name: 'paths',
    description: 'Outputs the paths to all elements in the input structure.',
    params: [],
  },
  {
    id: 'leaf_paths',
    name: 'leaf_paths',
    description: 'Outputs the paths to all leaf elements (scalars) in the input.',
    params: [],
  },
  {
    id: 'limit',
    name: 'limit',
    description: 'Outputs at most n values from the provided filter.',
    params: [
      { name: 'n', description: 'Maximum count' },
      { name: 'filter', description: 'Filter to limit' },
    ],
  },
  {
    id: 'first',
    name: 'first',
    description:
      'Outputs the first value produced by the filter — or, called bare, the first element of the input.',
    params: [
      {
        name: 'filter',
        description: 'Filter to evaluate (omit for the first element of the input)',
        optional: true,
      },
    ],
  },
  {
    id: 'last',
    name: 'last',
    description:
      'Outputs the last value produced by the filter — or, called bare, the last element of the input.',
    params: [
      {
        name: 'filter',
        description: 'Filter to evaluate (omit for the last element of the input)',
        optional: true,
      },
    ],
  },
  {
    id: 'nth',
    name: 'nth',
    description: 'Outputs the n-th value produced by the filter.',
    params: [
      { name: 'n', description: 'Index' },
      { name: 'filter', description: 'Filter to evaluate' },
    ],
  },
  {
    id: 'isempty',
    name: 'isempty',
    description: 'Returns true if the filter produces no output, false otherwise.',
    params: [{ name: 'filter', description: 'Filter to check' }],
  },
  {
    id: 'all',
    name: 'all',
    description:
      'Returns true if the filter evaluates to true for all elements in the input array/stream.',
    params: [{ name: 'filter', description: 'Filter to evaluate' }],
  },
  {
    id: 'any',
    name: 'any',
    description:
      'Returns true if the filter evaluates to true for any element in the input array/stream.',
    params: [{ name: 'filter', description: 'Filter to evaluate' }],
  },
  {
    id: 'transpose',
    name: 'transpose',
    description: 'Transposes an array of arrays (swaps rows and columns).',
    params: [],
  },
  {
    id: 'combinations_0',
    name: 'combinations',
    description: 'Outputs all combinations of elements from the input arrays.',
    params: [],
  },
  {
    id: 'combinations_1',
    name: 'combinations',
    description: 'Outputs all combinations of length n from the input array.',
    params: [{ name: 'n', description: 'Combination length' }],
  },
  {
    id: 'group_by',
    name: 'group_by',
    description: 'Groups the elements of the input array by the value of the path expression.',
    params: [{ name: 'path_expression', description: 'Path to group by' }],
  },
  {
    id: 'sort',
    name: 'sort',
    description: 'Sorts the elements of the input array.',
    params: [],
  },
  {
    id: 'sort_by',
    name: 'sort_by',
    description: 'Sorts the elements of the input array by the given path.',
    params: [{ name: 'path_expression', description: 'Path to sort by' }],
  },
  {
    id: 'unique',
    name: 'unique',
    description: 'Removes duplicates from the input array.',
    params: [],
  },
  {
    id: 'unique_by',
    name: 'unique_by',
    description: 'Removes duplicates from the input array based on the given path.',
    params: [{ name: 'path_expression', description: 'Path for uniqueness' }],
  },
  {
    id: 'min_by',
    name: 'min_by',
    description: 'Returns the element with the minimum value at the given path.',
    params: [{ name: 'path_expression', description: 'Path to compare' }],
  },
  {
    id: 'max_by',
    name: 'max_by',
    description: 'Returns the element with the maximum value at the given path.',
    params: [{ name: 'path_expression', description: 'Path to compare' }],
  },
];

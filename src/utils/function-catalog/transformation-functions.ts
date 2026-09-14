/**
 * @fileoverview jq value transformation built-ins (length, keys, type coercion).
 */

import type { FunctionDef } from './types';

export const transformationFunctions: FunctionDef[] = [
  {
    id: 'length',
    name: 'length',
    description: 'Returns the length of a string, array, or object.',
    params: [],
  },
  {
    id: 'utf8bytelength',
    name: 'utf8bytelength',
    description: 'Returns the number of bytes used to encode a string in UTF-8.',
    params: [],
  },
  {
    id: 'keys',
    name: 'keys',
    description: "Returns an array of the object's keys (sorted).",
    params: [],
  },
  {
    id: 'keys_unsorted',
    name: 'keys_unsorted',
    description: "Returns an array of the object's keys (original order).",
    params: [],
  },
  {
    id: 'has',
    name: 'has',
    description: 'Returns true if the object has the given key or the array has the given index.',
    params: [{ name: 'key', description: 'Key or index to check' }],
  },
  {
    id: 'in',
    name: 'in',
    description: 'Returns true if the input key is in the given object.',
    params: [{ name: 'object', description: 'Object to check in' }],
  },
  {
    id: 'del',
    name: 'del',
    description: 'Removes the element at the specified path from the object/array.',
    params: [{ name: 'path_expression', description: 'Path to delete' }],
  },
  {
    id: 'tostring',
    name: 'tostring',
    description: 'Converts the input value to a JSON string.',
    params: [],
  },
  {
    id: 'tonumber',
    name: 'tonumber',
    description: 'Converts the input string to a number.',
    params: [],
  },
  {
    id: 'fromjson',
    name: 'fromjson',
    description: 'Parses a JSON string and returns the structure.',
    params: [],
  },
  {
    id: 'tojson',
    name: 'tojson',
    description: 'Dumps the input structure to a JSON string.',
    params: [],
  },
  {
    id: 'type',
    name: 'type',
    description: "Returns the type of the input (e.g., 'string', 'number', 'array').",
    params: [],
  },
  {
    id: 'error',
    name: 'error',
    description: 'Aborts processing and outputs an error message.',
    params: [{ name: 'message', description: 'Error message' }],
  },
  { id: 'halt', name: 'halt', description: 'Stops the jq program.', params: [] },
  {
    id: 'add',
    name: 'add',
    description:
      'Adds all elements of an array (sum numbers, concatenate strings/arrays, merge objects).',
    params: [],
  },
];

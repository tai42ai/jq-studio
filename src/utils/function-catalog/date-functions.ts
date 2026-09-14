/**
 * @fileoverview jq date and time built-ins (now, strftime, ISO 8601 codecs).
 */

import type { FunctionDef } from './types';

export const dateFunctions: FunctionDef[] = [
  { id: 'now', name: 'now', description: 'Returns the current time since epoch.', params: [] },
  {
    id: 'strftime',
    name: 'strftime',
    description: 'Formats a timestamp string.',
    params: [{ name: 'format', description: 'Format string' }],
  },
  {
    id: 'strptime',
    name: 'strptime',
    description: 'Parses a time string.',
    params: [{ name: 'format', description: 'Format string' }],
  },
  {
    id: 'fromdate',
    name: 'fromdate',
    description: 'Parses an ISO 8601 date string to a timestamp.',
    params: [],
  },
  {
    id: 'todate',
    name: 'todate',
    description: 'Formats a timestamp as an ISO 8601 string.',
    params: [],
  },
];

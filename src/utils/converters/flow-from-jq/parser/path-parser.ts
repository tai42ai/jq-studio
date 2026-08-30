/**
 * @fileoverview Path expression parser.
 */

import { type PathSegment } from '../../../../types';

/**
 * Parses a path string into path segments with full support for all path types.
 *
 * Supports:
 * - Root: .
 * - Fields: .field, .nested.field
 * - Indices: .[0], .[123]
 * - Ranges: .[0:5], .[2:]
 * - Mixed: .field[0].nested[1:3]
 *
 * @param pathStr - Path string like ".field.nested[0]" or ".[1:3]"
 * @returns Array of path segments
 * @throws {Error} If path syntax is invalid
 *
 * @example
 * parsePathToSegments('.field[0]'); // Returns: [{ type: 'field', value: 'field' }, { type: 'index', value: '0' }]
 */
export function parsePathToSegments(pathStr: string): PathSegment[] {
  const segments: PathSegment[] = [];

  if (pathStr === '.') {
    segments.push({ id: 'seg_0', type: 'root', value: '.' });
    return segments;
  }

  let current = pathStr;
  let segmentIndex = 0;

  // Start with root if path begins with '.'
  if (current.startsWith('.')) {
    current = current.substring(1);
  }

  while (current.length > 0) {
    // Check for array index or range [...]
    if (current.startsWith('[')) {
      const closeIndex = current.indexOf(']');
      if (closeIndex === -1) {
        throw new Error(`Unclosed bracket in path: ${pathStr}`);
      }

      const bracketContent = current.substring(1, closeIndex);

      // Check if it's a range (contains ':')
      if (bracketContent.includes(':')) {
        const [start, end] = bracketContent.split(':');
        segments.push({
          id: `seg_${String(segmentIndex++)}`,
          type: 'range',
          value: (start ?? '').trim(),
          rangeEnd: (end ?? '').trim(),
        });
      } else {
        // It's an index
        segments.push({
          id: `seg_${String(segmentIndex++)}`,
          type: 'index',
          value: bracketContent.trim(),
        });
      }

      current = current.substring(closeIndex + 1);

      // Skip the dot after bracket if present
      if (current.startsWith('.')) {
        current = current.substring(1);
      }
    } else {
      // It's a field name
      const nextSpecial = current.search(/[.[]/);
      const fieldName = nextSpecial === -1 ? current : current.substring(0, nextSpecial);

      if (fieldName.length > 0) {
        segments.push({
          id: `seg_${String(segmentIndex++)}`,
          type: 'field',
          value: fieldName,
        });
      }

      current = nextSpecial === -1 ? '' : current.substring(nextSpecial);

      // Skip the dot before next segment
      if (current.startsWith('.')) {
        current = current.substring(1);
      }
    }
  }

  return segments;
}

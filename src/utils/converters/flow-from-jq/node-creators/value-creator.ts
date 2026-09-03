/**
 * @fileoverview Creates Value nodes with support for all value types including paths.
 */

import { type JQNode, type PathSegment } from '../../../../types';
import { JQNodeType, ValueType } from '../../../../enums';
import { type ConversionContext } from '../types';
import { generateNodeId } from './utils';

/**
 * Creates a Value node.
 *
 * @param value - The value or path expression (string | number | boolean | null)
 * @param valueType - Type of the value
 * @param context - Conversion context
 * @returns The created node ID
 */
export function createValueNode(
  value: string | number | boolean | null,
  valueType: ValueType,
  context: ConversionContext,
): string {
  const nodeId = generateNodeId(context);

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.Value,
    position: { x: 0, y: 0 }, // Will be positioned later
    data: {
      type: JQNodeType.Value,
      valueType,
      value: valueType === ValueType.Path ? undefined : value,
      pathValue: valueType === ValueType.Path ? (value as string) : undefined,
      pathSegments: valueType === ValueType.Path ? parsePathToSegments(value as string) : undefined,
    },
  };

  context.nodes.push(node);
  return nodeId;
}

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
 */
function parsePathToSegments(pathStr: string): PathSegment[] {
  const segments: PathSegment[] = [];

  if (pathStr === '.') {
    segments.push({ id: 'seg_0', type: 'root', value: '.' });
    return segments;
  }

  let current = pathStr;
  let segmentIndex = 0;

  // Variable reference ($var) — use node_ref with name only (no $ prefix)
  // so it matches precedingNodeNames in PathSelector dropdown. A postfix path
  // (`$var.field`, `$var["key"]`) continues into the segment loop below,
  // composing onto the reference the way it composes onto `.`.
  if (current.startsWith('$')) {
    const varMatch = /^\$(\w+)/.exec(current);
    const varName = varMatch?.[1] ?? current.substring(1);
    segments.push({ id: `seg_${String(segmentIndex++)}`, type: 'node_ref', value: varName });
    current = current.substring(1 + varName.length);
    // Skip the dot before a field segment (`$var.field` → field `field`)
    if (current.startsWith('.')) {
      current = current.substring(1);
    }
  } else if (current.startsWith('.')) {
    // Start with root if path begins with '.'
    segments.push({ id: `seg_${String(segmentIndex++)}`, type: 'root', value: '.' });
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

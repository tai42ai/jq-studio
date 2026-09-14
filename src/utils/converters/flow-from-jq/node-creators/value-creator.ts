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
 * Reads the leading root (`.`) or variable-reference (`$var`) segment of a path.
 *
 * A variable reference becomes a `node_ref` carrying the name only (no `$`
 * prefix), so it matches precedingNodeNames in the PathSelector dropdown; a
 * postfix path (`$var.field`, `$var["key"]`) is left in `rest` to compose onto
 * the reference the way it composes onto `.`.
 *
 * @param pathStr - The whole path string
 * @returns The leading segment (or null when the path opens with neither), and
 *   the remaining string after it
 */
function readPathPrefix(pathStr: string): { segment: PathSegment | null; rest: string } {
  if (pathStr.startsWith('$')) {
    const varMatch = /^\$(\w+)/.exec(pathStr);
    const varName = varMatch?.[1] ?? pathStr.substring(1);
    let rest = pathStr.substring(1 + varName.length);
    if (rest.startsWith('.')) rest = rest.substring(1);
    return { segment: { id: 'seg_0', type: 'node_ref', value: varName }, rest };
  }
  if (pathStr.startsWith('.')) {
    return { segment: { id: 'seg_0', type: 'root', value: '.' }, rest: pathStr.substring(1) };
  }
  return { segment: null, rest: pathStr };
}

/**
 * Reads a `[...]` path segment's content into an index or range segment.
 *
 * A quoted key is an index segment whatever it contains — a colon inside the
 * quotes (`["a:b"]`) is part of the key, not a range separator, and a range read
 * would surface it in the editor as a range picker.
 *
 * @param content - The text between the brackets
 * @param id - The segment id to assign
 * @returns The index or range path segment
 */
function readBracketSegment(content: string, id: string): PathSegment {
  if (content.trimStart().startsWith('"')) {
    return { id, type: 'index', value: content.trim() };
  }
  if (content.includes(':')) {
    const [start, end] = content.split(':');
    return { id, type: 'range', value: (start ?? '').trim(), rangeEnd: (end ?? '').trim() };
  }
  return { id, type: 'index', value: content.trim() };
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
  if (pathStr === '.') {
    return [{ id: 'seg_0', type: 'root', value: '.' }];
  }

  const segments: PathSegment[] = [];
  const { segment: prefix, rest } = readPathPrefix(pathStr);
  if (prefix) segments.push(prefix);

  let current = rest;
  let segmentIndex = segments.length;
  const nextId = () => `seg_${String(segmentIndex++)}`;

  while (current.length > 0) {
    if (current.startsWith('[')) {
      const closeIndex = current.indexOf(']');
      if (closeIndex === -1) {
        throw new Error(`Unclosed bracket in path: ${pathStr}`);
      }
      segments.push(readBracketSegment(current.substring(1, closeIndex), nextId()));
      current = current.substring(closeIndex + 1);
    } else {
      const nextSpecial = current.search(/[.[]/);
      const fieldName = nextSpecial === -1 ? current : current.substring(0, nextSpecial);
      if (fieldName.length > 0) {
        segments.push({ id: nextId(), type: 'field', value: fieldName });
      }
      current = nextSpecial === -1 ? '' : current.substring(nextSpecial);
    }

    // Skip the dot separating this segment from the next
    if (current.startsWith('.')) {
      current = current.substring(1);
    }
  }

  return segments;
}

/**
 * @fileoverview Value node expression generator.
 */

import { type JQNode, type JQValueData } from '../../../../types';
import { ValueType, JQHandleIdPrefix } from '../../../../enums';
import { compilePathSegments } from '../../../path-segments';
import { type ConversionContext } from '../types';
import { escapeStringLiteral } from '../utils/string-utils';
import { formatArray, formatObject } from '../utils/formatter';
import { edgeTargetNode } from '../utils/validators';
import { asTerm } from '../expression-builder';
import { buildBranchChainExpression, type NodeExpressionFn } from './branch-chain-builder';

/**
 * Generates a jq expression for a Value node.
 *
 * Handles all value types: string, number, boolean, array, object, path, null.
 *
 * Note: For array and object types with non-contiguous indices (e.g., item:0, item:2 but no item:1),
 * the generated array/object will omit the missing indices. This is expected behavior.
 *
 * @param node - The Value node
 * @param context - Conversion context
 * @param nodeExpressionFn - Function to generate expressions for child nodes
 * @param indent - Current indentation level (default 0)
 * @returns The jq expression string
 * @throws {Error} If the value type is unsupported
 * @throws {Error} If an array item edge names an item the node does not declare
 * @throws {Error} If an object field edge names a field the node does not declare
 */
export function generateValueExpression(
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent = 0,
): string {
  const data = node.data as JQValueData;

  switch (data.valueType) {
    case ValueType.String:
      return `"${escapeStringLiteral((data.value ?? '') as string)}"`;

    case ValueType.Number:
      return String(data.value ?? 0);

    case ValueType.Boolean:
      return String(data.value ?? false);

    case ValueType.Null:
      return 'null';

    case ValueType.Path:
      // Compile the structured path segments into a jq path expression.
      if (data.pathSegments && data.pathSegments.length > 0) {
        return compilePathSegments(data.pathSegments);
      }
      return '.';

    case ValueType.Array: {
      // Arrays have item connections via item:N handles
      const items: string[] = [];
      const outgoingEdges = context.edgesBySource.get(node.id) ?? [];

      // Sort edges by item index (item:item_0, item:item_1, etc.)
      const itemEdges = outgoingEdges
        .filter((e) => e.sourceHandle?.startsWith(JQHandleIdPrefix.Item))
        .map((edge) => {
          const itemId = (edge.sourceHandle ?? '').split(':')[1] ?? '';
          const index = data.items?.findIndex((i) => i.id === itemId) ?? -1;
          // An edge naming an item the node does not declare has no position —
          // emitting it anyway would place a value at an index the flow never draws.
          if (index < 0) {
            throw new Error(
              `Array node ${node.id} has no item ${itemId} for edge ${edge.id} — ` +
                'reconnect the edge to an item the node declares',
            );
          }
          return { edge, index };
        })
        .sort((a, b) => a.index - b.index);

      for (const { edge } of itemEdges) {
        // Follow pipe chain from item entry node
        const itemExpr = buildBranchChainExpression(
          edgeTargetNode(context, edge),
          context,
          nodeExpressionFn,
          indent + 1,
        );
        items.push(asTerm(itemExpr));
      }

      // Use formatter utility for smart formatting
      return formatArray(items, indent);
    }

    case ValueType.Object: {
      // Objects have field connections via field:N handles
      const fields: string[] = [];
      const outgoingEdges = context.edgesBySource.get(node.id) ?? [];

      // Sort edges by field index, so the object reads in the order the node
      // declares its fields rather than the order the edges were drawn in
      const declaredFields = data.fields ?? [];
      const fieldEdges = outgoingEdges
        .filter((e) => e.sourceHandle?.startsWith(JQHandleIdPrefix.Field))
        .map((edge) => {
          const fieldId = (edge.sourceHandle ?? '').split(':')[1] ?? '';
          const index = declaredFields.findIndex((f) => f.id === fieldId);
          const fieldMeta = declaredFields[index];
          // An edge naming a field the node does not declare has no key and no
          // position — dropping it would silently omit a connected value.
          if (!fieldMeta) {
            throw new Error(
              `Object node ${node.id} has no field ${fieldId} for edge ${edge.id} — ` +
                'reconnect the edge to a field the node declares',
            );
          }
          return { edge, fieldMeta, index };
        })
        .sort((a, b) => a.index - b.index);

      for (const { edge, fieldMeta } of fieldEdges) {
        // Follow pipe chain from field value entry node
        const valueExpr = buildBranchChainExpression(
          edgeTargetNode(context, edge),
          context,
          nodeExpressionFn,
          indent + 1,
        );
        fields.push(`"${escapeStringLiteral(fieldMeta.name)}": ${asTerm(valueExpr)}`);
      }

      // Use formatter utility for smart formatting
      return formatObject(fields, indent);
    }

    default:
      throw new Error(`Unsupported value type: ${String(data.valueType)} in node ${node.id}`);
  }
}

/**
 * @fileoverview Pure graph-scope traversals over the jq flow: the named nodes
 * upstream of a node, the function parameters in scope from ancestor
 * declarations, and the custom functions declared off the Start node.
 */

import type { Edge, Node } from '@xyflow/react';

import { JQHandleIdPrefix, JQNodeType } from '../enums';
import type { JQFunctionDeclData, JQNodeData } from '../types';
import type { FunctionDef } from './function-catalog';

/**
 * The names of `Value`/`FunctionCall` nodes reachable upstream of `nodeId` — the
 * variables a path root may reference. Walks target→source edges transitively.
 */
export const precedingNamedNodes = (
  nodes: Node<JQNodeData>[],
  edges: Edge[],
  nodeId: string,
): string[] => {
  const upstream = new Set<string>();
  const visit = (nId: string): void => {
    for (const e of edges) {
      if (e.target === nId && !upstream.has(e.source)) {
        upstream.add(e.source);
        visit(e.source);
      }
    }
  };
  visit(nodeId);

  return nodes
    .filter(
      (n) =>
        upstream.has(n.id) &&
        (n.data.type === JQNodeType.Value || n.data.type === JQNodeType.FunctionCall) &&
        !!n.data.name,
    )
    .map((n) => n.data.name ?? '');
};

/**
 * The parameter names declared by the node `source` — its own `parameters` when
 * it is a `FunctionDecl`, otherwise none.
 */
const paramsFromDeclNode = (nodes: Node<JQNodeData>[], source: string): string[] => {
  const sourceNode = nodes.find((n) => n.id === source);
  if (sourceNode?.data.type !== JQNodeType.FunctionDecl) return [];

  return sourceNode.data.parameters ?? [];
};

/**
 * The distinct function-parameter names in scope at `nodeId` — collected from
 * every `FunctionDecl` ancestor reachable by walking target→source edges.
 */
export const ancestorFunctionParams = (
  nodes: Node<JQNodeData>[],
  edges: Edge[],
  nodeId: string,
): string[] => {
  const visited = new Set<string>();
  const queue = [nodeId];
  const params: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const e of edges) {
      if (e.target !== current) continue;
      params.push(...paramsFromDeclNode(nodes, e.source));
      queue.push(e.source);
    }
  }

  return [...new Set(params)];
};

/**
 * The custom functions a flow declares — the named `FunctionDecl` nodes wired to
 * the Start node's `functions` handle, shaped as {@link FunctionDef}s.
 */
export const customFunctionDefs = (nodes: Node<JQNodeData>[], edges: Edge[]): FunctionDef[] => {
  const startNode = nodes.find((n) => n.type === JQNodeType.Start);
  if (!startNode) return [];

  const funcEdges = edges.filter(
    (e) => e.source === startNode.id && e.sourceHandle === JQHandleIdPrefix.Functions,
  );

  return funcEdges
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter(
      (n): n is Node<JQFunctionDeclData> =>
        n?.data.type === JQNodeType.FunctionDecl && !!n.data.name,
    )
    .map((n) => {
      const fnName = n.data.name ?? '';
      return {
        id: fnName,
        name: fnName,
        description: `Custom function: ${fnName}`,
        params: (n.data.parameters ?? []).map((p) => ({
          name: p,
          description: `Parameter: ${p}`,
        })),
      };
    });
};

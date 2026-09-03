/**
 * @fileoverview Helpers for reasoning about pipe chains in the parsed AST.
 *
 * A jq pipe chain is a sequence of stages joined by `|`. The parser nests them
 * to the right, but a parenthesised sub-chain can surface as the LEFT of an
 * outer pipe or as an operator operand, so callers that walk a chain must be
 * able to flatten it and to tell a genuine multi-stage chain apart from a bare
 * term wrapped in redundant identity pipes.
 */
import { type ASTNode } from './types';

/**
 * Flattens a (possibly nested) `Pipe` AST into its ordered stages.
 *
 * Both operands are descended, so `(.a | .b) | .c` — which parses to
 * `Pipe(Pipe(.a, .b), .c)` — flattens to `[.a, .b, .c]` rather than losing the
 * middle stage to a left-nested read.
 *
 * @param node - The AST node to flatten
 * @returns The chain's stages in left-to-right order (a non-pipe yields itself)
 */
export function flattenPipeStages(node: ASTNode): ASTNode[] {
  if (node.type === 'Pipe') {
    return [...flattenPipeStages(node.left), ...flattenPipeStages(node.right)];
  }
  return [node];
}

/**
 * Stage kinds an operator operand's pipe can carry and still round-trip: each is
 * a single term the serialiser inlines onto the operand's bottom chain, so the
 * whole chain re-emits between the operand's own parentheses. An `Identity` stage
 * is a passthrough and never reaches this set (it is filtered first).
 */
const CHAINABLE_OPERAND_STAGES: ReadonlySet<ASTNode['type']> = new Set([
  'Path',
  'Variable',
  'String',
  'Number',
  'Boolean',
  'Null',
  'FunctionCall',
  'Comment',
]);

/**
 * Reports whether a node placed in an operator operand slot is a pipe chain the
 * serialiser CANNOT round-trip faithfully.
 *
 * An operator wires each side to ONE source node, and the serialiser rebuilds a
 * pipe operand by walking that node's bottom chain. That walk re-inlines a chain
 * of simple terms (`.a | last | .b`) correctly, but it stops at — or reorders —
 * a stage that is itself an operator, a conditional, a try/catch, or an array/
 * object/assignment, stranding the stages past it OUTSIDE the operator. That is
 * the silent corruption seen in e.g. `((.a // {}) | .b) // []` and
 * `(X // {} | [.[]] | first) == "ask"`. Such an operand has no faithful graph, so
 * the parser refuses it (honest PARSE-FAIL) instead of drawing a wrong one.
 *
 * A single-term operand (`Pipe(Identity, X)` reduces to `X`) and a pipe of only
 * simple chainable terms both stay representable and are accepted.
 *
 * @param node - The operand AST node to test
 * @returns True when the operand is a multi-stage pipe with a non-chainable stage
 */
export function isUnrepresentableOperand(node: ASTNode): boolean {
  if (node.type !== 'Pipe') return false;
  const stages = flattenPipeStages(node).filter((stage) => stage.type !== 'Identity');
  if (stages.length < 2) return false;
  return stages.some((stage) => !CHAINABLE_OPERAND_STAGES.has(stage.type));
}

/**
 * Reports whether naming an assignment's value would land the `as $var` INSIDE
 * one of the value's operator operands, splitting it.
 *
 * `EXPR as $var` is drawn by naming EXPR's entry node. For an operator value the
 * entry is the leftmost operand's first chain node, and the serialiser reads a
 * NAME there as "bind here, the bottom chain continues the outer pipe" — so when
 * that operand is a multi-stage pipe, its later stages are stranded outside the
 * operator and the binding moves to the first stage alone:
 * `((.a | type) == "x") as $v` came back as `(.a == "x") as $v … | type`. Such a
 * value has no faithful drawing, so the parser refuses it (honest PARSE-FAIL).
 * An operator value whose leftmost operand is a single term keeps its name at
 * the operand entry and re-emits whole — those stay accepted.
 *
 * @param value - The assignment's value AST node
 * @returns True when the value is an operator with a multi-stage pipe anywhere
 *   on its leftmost-operand spine
 */
export function assignmentNameSplitsOperand(value: ASTNode): boolean {
  let node = value;
  while (node.type === 'Operator') {
    let left: ASTNode = node.left;
    if (left.type === 'Pipe') {
      const stages = flattenPipeStages(left).filter((stage) => stage.type !== 'Identity');
      if (stages.length >= 2) return true;
      left = stages[0] ?? left;
    }
    if (left.type !== 'Operator') return false;
    node = left;
  }
  return false;
}

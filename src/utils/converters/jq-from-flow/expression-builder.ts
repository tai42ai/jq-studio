/**
 * @fileoverview Main expression chain builder for JQ from Flow converter.
 */

import { type JQNode, type JQEdge } from '../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../enums';
import { type ConversionContext } from './types';
import { classifyEdge } from './utils/edge-classifier';
import { validateVariableName, enterChainNode, edgeTargetNode } from './utils/validators';
import { shouldCreateVariable } from './utils/variable-checker';
import { generateNodeExpression } from './generators/node-generator';
import { findOutermostOperator, findPipeChainEnd } from './utils/operator-resolver';

// Re-export for consumers that import from expression-builder
export { shouldCreateVariable };

/**
 * A part of the expression output — either a jq expression or a comment line.
 */
export interface ExpressionPart {
  type: 'expression' | 'comment';
  text: string;
}

/**
 * Splits a Comment node's text into one comment part per non-blank line.
 *
 * Every chain walker renders a Comment node this way, so the `# text` lines a
 * multiline comment produces are identical in every context.
 */
export function commentParts(text: string): ExpressionPart[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => ({ type: 'comment' as const, text: line.trim() }));
}

/**
 * Joins expression parts with smart formatting:
 * - Expression parts get `| ` prefix (except the first expression)
 * - Comment parts get `# ` prefix (never `| ` prefix)
 * - Each part goes on its own line; an inline join keeps parts on one line
 *   except where a comment forces a line break
 *
 * A jq `#` comment runs to the end of its line, so whatever follows a comment
 * part starts on a new line even in an inline join — separating it with a space
 * would comment out the rest of the chain. An inline join that ends on a comment
 * is terminated with a newline for the same reason: an inline result is embedded
 * in surrounding syntax (`f(<join>)`, `f(<join>; …)`, `def f: <join>;`,
 * `(<join>)`), and an unterminated comment line swallows the delimiter that
 * follows it.
 *
 * Comments annotate an expression, they are not one: a chain whose nodes
 * contribute no expression part has nothing to emit into the position it
 * occupies, so it is rejected here rather than turned into uncompilable jq.
 *
 * @param parts - The expression parts to join
 * @param chainEntryNodeId - The id of the node the chain starts at, named in the
 *   comments-only error
 * @param inline - If true, join with ` | ` instead of newlines, apart from the
 *   line breaks comments force (for param, function-body, branch and operand chains)
 * @throws {Error} If no part is an expression
 */
export function joinExpressionParts(
  parts: ExpressionPart[],
  chainEntryNodeId: string,
  inline = false,
): string {
  if (!parts.some((part) => part.type === 'expression')) {
    throw new Error(
      `Chain starting at node ${chainEntryNodeId} cannot consist of comments only — ` +
        'connect a node that produces a value',
    );
  }

  let joined = '';
  let isFirst = true;
  let needsPipe = false;
  let previousWasComment = false;
  for (const part of parts) {
    if (isFirst) {
      isFirst = false;
    } else {
      joined += !inline || previousWasComment ? '\n' : ' ';
    }
    if (part.type === 'comment') {
      joined += `# ${part.text}`;
      // Comments don't produce values — don't set needsPipe
    } else {
      joined += needsPipe ? `| ${part.text}` : part.text;
      needsPipe = true;
    }
    previousWasComment = part.type === 'comment';
  }
  if (inline && previousWasComment) {
    joined += '\n';
  }
  return joined;
}

/**
 * Reports whether an expression carries a `|` outside every bracket, string
 * literal and comment, or a closing bracket the count never opened.
 *
 * Brackets are counted so the pipes a nested `f(.a | length)`, `[…]` or `{…}`
 * already encloses do not count. A `"…"` literal is skipped: every generated
 * literal comes from `escapeStringLiteral`, which escapes backslashes first, so
 * no `\(…)` interpolation can reopen jq code inside one. A `#` comment is
 * skipped to the end of its line, because a Comment node's text is written by
 * the flow's author and may hold anything — brackets, quotes and pipes included.
 */
function hasTopLevelPipe(expr: string): boolean {
  let depth = 0;
  let inString = false;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '#') {
      const lineEnd = expr.indexOf('\n', i);
      if (lineEnd < 0) return false;
      i = lineEnd;
    } else if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      // A stray closer corrupts the depth count; wrapping is the safe answer
      // (parentheses are inert in jq).
      if (depth < 0) return true;
    } else if (char === '|' && depth === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Parenthesises an expression that jq would not read as a single *term*.
 *
 * This is the converter's one wrapping rule. A term is jq's atomic unit — a
 * literal, a path, a `f(…)` call, a bracketed `(…)` / `[…]` / `{…}` — and every
 * position this converter embeds an expression into that is sensitive to binding
 * accepts a term unchanged:
 *
 * - both operands of a binary operator, and the operand of the postfix `?`:
 *   `|` binds looser than every operator, so `(.items | length) == .n` emitted
 *   bare reads as `.items | (length == .n)`, and `?` attaches to the term on its
 *   left, so a bare `.a | length?` suppresses errors from `length` alone
 * - an array item: `|` binds looser than `,`, so a bare piped item swallows the
 *   items after it
 * - an object field value: jq reads a field value as a term or a pipe of terms,
 *   so `if`, `try`, `as` and bare operators are syntax errors there
 * - a try and a catch branch: `try` and `catch` bind tighter than `|`, so a bare
 *   piped branch leaves its tail outside the construct it belongs to
 *
 * Two shapes are not terms. One carries a pipe outside every bracket, string and
 * comment — which is also how a chain's `<expr> as $name` binding shows up, since
 * the walkers always close a binding by piping the bound name out of it. The
 * other opens on `if` or `try`, whose own text ends at `end` or at the branch,
 * not at a bracket. A chain that ends on a comment needs no parentheses: the
 * inline join already terminates it with a newline, so whatever the position
 * appends starts on a line of its own.
 *
 * The positions jq delimits already are left alone — the program's top level, a
 * call's arguments (`f(…; …)`), a `def` body, an `if` / `then` / `else` branch,
 * and the left side of the pipe a call's root input builds. Each of those reads a
 * whole expression, ended by the syntax around it, so parentheses there would say
 * nothing the grammar does not already say.
 */
export function asTerm(expr: string): string {
  const head = firstExpressionLine(expr);
  if (hasTopLevelPipe(expr) || head.startsWith('if ') || head.startsWith('try ')) {
    return `(${expr})`;
  }
  return expr;
}

/**
 * Returns the first line of a chain expression that is not a `# text` comment
 * line, trimmed — the line a keyword test such as `if` / `try` has to read.
 *
 * A chain that opens with a Comment node puts its comment lines ahead of the
 * expression, so the keyword is not at the start of the string.
 *
 * Every expression reaching here holds one: {@link joinExpressionParts} builds
 * each chain and rejects one made of comments only, and a node's own generated
 * expression never consists of comments. An expression without such a line is a
 * walker that stopped enforcing that, and answering with an empty line would
 * hand the keyword test a head no expression has.
 *
 * @throws {Error} If every line is blank or a comment
 */
export function firstExpressionLine(expr: string): string {
  for (const line of expr.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    return trimmed;
  }
  throw new Error(
    `Expression has no line that is not a comment: ${JSON.stringify(expr)} — ` +
      'a chain of comments only is rejected where the chain is joined',
  );
}

/**
 * A `<expr> as $name` part whose body has not been emitted yet.
 *
 * jq reads `as` as a binding over the expression that follows it, so the part is
 * not a complete expression on its own.
 */
export interface OpenBinding {
  /** The part carrying the binding, mutated when the binding is closed. */
  part: ExpressionPart;
  /** The bound variable's name, without the `$`. */
  varName: string;
}

/**
 * Appends the part a chain node contributes and reports whether that part left a
 * variable binding open.
 *
 * A named node contributes `<expr> as $name`, which binds `$name` over whatever
 * the chain pipes into next — so the part only stands on its own once something
 * reads the binding. `pipeAfterDeclare` says the node wants the chain to carry on
 * from `$name`; otherwise the chain carries on from the node's input and the
 * binding stays open, for {@link closeOpenBinding} to settle at the end of the walk.
 *
 * @param parts - The parts collected so far, appended to in place
 * @param node - The chain node contributing the part
 * @param nodeExpr - The node's own generated expression
 * @param createsVariable - Whether the node binds its expression to its name
 * @returns The binding the part left open, or null when the part is complete
 * @throws {Error} If the node's name is not a valid jq variable name
 */
export function pushChainPart(
  parts: ExpressionPart[],
  node: JQNode,
  nodeExpr: string,
  createsVariable: boolean,
): OpenBinding | null {
  if (!createsVariable) {
    parts.push({ type: 'expression', text: nodeExpr });
    return null;
  }

  const varName = node.data.name ?? '';
  validateVariableName(varName);

  if (node.data.pipeAfterDeclare) {
    parts.push({ type: 'expression', text: `${nodeExpr} as $${varName} | $${varName}` });
    return null;
  }

  const part: ExpressionPart = { type: 'expression', text: `${nodeExpr} as $${varName}` };
  parts.push(part);
  return { part, varName };
}

/**
 * Closes a binding the chain ended on by piping the bound variable out of it.
 *
 * `<expr> as $name` with nothing after it is a jq syntax error, and the value the
 * chain is expected to yield in that position is the one the binding names.
 *
 * @param openBinding - The binding {@link pushChainPart} left open, if any
 */
export function closeOpenBinding(openBinding: OpenBinding | null): void {
  if (!openBinding) return;
  openBinding.part.text += ` | $${openBinding.varName}`;
}

/**
 * Resolves the node a chain walk's bottom-handle edge leads to.
 *
 * A node with no bottom-handle edge is the end of its chain — the walk stops there
 * because the flow draws nothing after it. A node the walk already passed through
 * is a chain that loops, which has no end at all.
 *
 * @param nextEdge - The bottom-handle edge leaving the node, or undefined at the chain's end
 * @param context - Conversion context
 * @param visited - The node ids this walk has passed through, added to in place
 * @returns The next node in the chain, or null when the chain ends
 * @throws {Error} If the edge leads back to a node this walk already passed through
 */
export function nextChainNode(
  nextEdge: JQEdge | undefined,
  context: ConversionContext,
  visited: Set<string>,
): JQNode | null {
  if (!nextEdge) return null;

  const nextNode = edgeTargetNode(context, nextEdge);
  enterChainNode(visited, nextNode, nextEdge);
  return nextNode;
}

/**
 * Builds the main expression chain starting from the Start node's "flow" handle.
 *
 * This performs a topological traversal, generating expressions for each node
 * and wrapping them with variable assignments as needed — a binding the chain
 * ends on is closed with `| $name` so the chain yields the value it binds.
 * Comment nodes in the chain emit `# text` on their own lines (no `|` prefix);
 * a chain of nothing but Comment nodes has no expression to emit and is rejected.
 *
 * @param startNode - The Start node
 * @param context - Conversion context
 * @returns The main jq expression string
 * @throws {Error} If the chain consists of comments only
 * @throws {Error} If the chain loops back on a node it already passed through
 */
export function buildMainExpression(startNode: JQNode, context: ConversionContext): string {
  // Find the flow entry point
  const startEdges = context.edgesBySource.get(startNode.id) ?? [];
  const flowEdge = startEdges.find((e) => e.sourceHandle === JQHandleIdPrefix.Flow);

  if (!flowEdge) {
    return '.';
  }

  const flowEntryNode = edgeTargetNode(context, flowEdge);

  // Traverse the main flow chain
  const expressionParts: ExpressionPart[] = [];
  const visited = new Set<string>([flowEntryNode.id]);
  let openBinding: OpenBinding | null = null;
  let currentNode: JQNode | null = flowEntryNode;

  while (currentNode) {
    // Comment nodes emit `# text` lines (no expression generation)
    if (currentNode.data.type === JQNodeType.Comment) {
      expressionParts.push(...commentParts(currentNode.data.text));

      // Follow bottom edge to next node
      const outgoingEdges: JQEdge[] = context.edgesBySource.get(currentNode.id) ?? [];
      const nextEdge: JQEdge | undefined = outgoingEdges.find(
        (e) => classifyEdge(e).isBottomHandle,
      );
      currentNode = nextChainNode(nextEdge, context, visited);
      continue;
    }

    const outgoingEdges = context.edgesBySource.get(currentNode.id) ?? [];

    // Check if this is a value node with an operator chain attached.
    const hasOperatorEdge = outgoingEdges.some(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );

    let nodeExpr: string;
    let pipeChainEndNode = currentNode;
    if (hasOperatorEdge) {
      const operatorNode = findOutermostOperator(currentNode.id, context);
      nodeExpr = generateNodeExpression(operatorNode, context, 0);
      pipeChainEndNode = findPipeChainEnd(currentNode, context);
    } else {
      nodeExpr = generateNodeExpression(currentNode, context, 0);
    }

    // Build the expression part (with optional variable assignment)
    openBinding = pushChainPart(
      expressionParts,
      currentNode,
      nodeExpr,
      shouldCreateVariable(currentNode, context),
    );

    // Find next node in the chain (via bottom handle from pipe chain end)
    const endOutgoing = context.edgesBySource.get(pipeChainEndNode.id) ?? [];
    const nextEdge = endOutgoing.find((e) => classifyEdge(e).isBottomHandle);
    currentNode = nextChainNode(nextEdge, context, visited);
  }

  closeOpenBinding(openBinding);

  return joinExpressionParts(expressionParts, flowEntryNode.id);
}

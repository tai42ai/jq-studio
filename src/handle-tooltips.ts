/**
 * Centralised, user-readable copy for every jq node handle (ports the flow
 * canvas's `handle-tooltips` idiom). A handle explains, on hover, what it
 * connects to — so the author never has to guess what an unlabelled dot does.
 *
 * jq handle ids are prefix tokens (`enums.JQHandleIdPrefix`), optionally suffixed
 * with `:<nodeId>[:…]`. We reduce an id to a coarse ROLE, then look the copy up
 * as `<nodeType>:<role>` first (kind-specific wording) and fall back to a generic
 * `<role>` entry (shared wording, e.g. both operands). Adding or retuning a
 * handle's explanation is a one-line edit here rather than scattered across the
 * node components.
 */
import { JQNodeType, JQHandleIdPrefix } from './enums';

export interface HandleTooltip {
  /** Short label — what this handle is. */
  readonly title: string;
  /** One-sentence plain-language explanation of what to connect and what happens. */
  readonly body: string;
}

/** The coarse role a handle plays, derived from its id prefix. */
const ROLE_BY_PREFIX: Record<string, string> = {
  [JQHandleIdPrefix.Top]: 'input',
  [JQHandleIdPrefix.Bottom]: 'output',
  [JQHandleIdPrefix.Functions]: 'functions',
  [JQHandleIdPrefix.Flow]: 'flow',
  [JQHandleIdPrefix.Inner]: 'logic',
  [JQHandleIdPrefix.Logic]: 'logic',
  [JQHandleIdPrefix.OperatorLeft]: 'left',
  [JQHandleIdPrefix.OperatorRight]: 'right',
  [JQHandleIdPrefix.Root]: 'data',
  [JQHandleIdPrefix.Param]: 'param',
  [JQHandleIdPrefix.Item]: 'item',
  [JQHandleIdPrefix.Field]: 'field',
  [JQHandleIdPrefix.If]: 'if',
  [JQHandleIdPrefix.Then]: 'then',
  [JQHandleIdPrefix.Else]: 'else',
  [JQHandleIdPrefix.Try]: 'try',
  [JQHandleIdPrefix.Catch]: 'catch',
};

/** Reduce a handle id to its role. The id is a prefix token (e.g. `operator-left---`)
 *  optionally followed by `:<nodeId>[:…]`; we key on the token before the first `:`. */
export const roleFromHandleId = (handleId: string | null | undefined): string | null => {
  if (!handleId) return null;
  const token = handleId.split(':')[0] ?? '';
  return ROLE_BY_PREFIX[token] ?? null;
};

/** Kind-specific copy, keyed `<nodeType>:<role>`. */
const T: Record<string, HandleTooltip> = {
  // --- Input (root) node ---
  [`${JQNodeType.Start}:functions`]: {
    title: 'Functions',
    body: 'Definitions available to the whole expression — connect Define Function nodes here.',
  },
  [`${JQNodeType.Start}:flow`]: {
    title: 'Result',
    body: 'The value this expression returns — connect the node that produces the output.',
  },

  // --- Operator ---
  [`${JQNodeType.Operator}:input`]: {
    title: 'Left operand',
    body: 'The value on the left of the operator.',
  },

  // --- Function Call ---
  [`${JQNodeType.FunctionCall}:data`]: {
    title: 'Data source',
    body: 'The input this function runs on — overrides the piped value from the previous node.',
  },
  [`${JQNodeType.FunctionCall}:param`]: {
    title: 'Parameter',
    body: "A value passed to this function's parameter.",
  },

  // --- Condition ---
  [`${JQNodeType.Condition}:if`]: {
    title: 'If',
    body: 'The condition to test — connect the value it checks.',
  },
  [`${JQNodeType.Condition}:then`]: {
    title: 'Then',
    body: 'The result produced when this branch matches.',
  },
  [`${JQNodeType.Condition}:else`]: {
    title: 'Else',
    body: 'The result produced when no branch matches.',
  },

  // --- Try / Catch ---
  [`${JQNodeType.TryCatch}:try`]: {
    title: 'Try',
    body: 'The logic to attempt.',
  },
  [`${JQNodeType.TryCatch}:catch`]: {
    title: 'Catch',
    body: 'The recovery to run if the try fails.',
  },

  // --- Define Function ---
  [`${JQNodeType.FunctionDecl}:input`]: {
    title: 'Grant',
    body: 'Wire this from Input to make this definition available to the whole expression.',
  },
  [`${JQNodeType.FunctionDecl}:logic`]: {
    title: 'Body',
    body: "The function's body expression.",
  },

  // --- Value collections ---
  [`${JQNodeType.Value}:item`]: {
    title: 'Item',
    body: 'An element of this array.',
  },
  [`${JQNodeType.Value}:field`]: {
    title: 'Field',
    body: "A field's value in this object.",
  },
};

/** Generic copy shared across kinds, keyed by role alone. */
const GENERIC: Record<string, HandleTooltip> = {
  input: {
    title: 'Input',
    body: 'The value piped into this node from the node connected above.',
  },
  output: {
    title: 'Output',
    body: 'The result of this node — drag to the node that consumes it.',
  },
  left: { title: 'Left operand', body: 'The value on the left of the operator.' },
  right: { title: 'Right operand', body: 'The value on the right of the operator.' },
  logic: { title: 'Logic', body: 'The expression this node runs.' },
  data: { title: 'Data source', body: 'The input this node runs on.' },
  param: { title: 'Parameter', body: 'A value passed to a parameter.' },
};

/** The roles whose ports carry a GLANCEABLE label DERIVED FROM THE HANDLE ID —
 *  a small pill on the card edge — because the port's role is otherwise invisible
 *  on a collapsed card. Control flow (`if` / `then` / `else`, `try` / `catch`),
 *  the function `body`, and a call's ORDER-BEARING positional args (`arg 1..n`)
 *  all qualify. Two order-bearing kinds are deliberately absent because their
 *  label is NODE-supplied, not id-derived: an operator's `a` / `b` operands and a
 *  collection's object keys / array indices (whose id is an opaque uuid) — those
 *  are set directly on the card instead. The plain input / output / data-source
 *  ports are unambiguous and stay bare. The label names a port exactly once; no
 *  separate on-wire chip duplicates it. */
const LABELLED_ROLES = new Set(['if', 'then', 'else', 'try', 'catch', 'logic', 'param']);

/** Parse the trailing numeric index of a suffixed handle id (`if---:2` -> 2),
 *  defaulting to 0 when there is none or it is unparseable. */
const handleIndex = (handleId: string | null | undefined): number => {
  const raw = (handleId ?? '').split(':')[1];
  const index = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(index) ? index : 0;
};

/** The short, glanceable label for a role-bearing port, or `null` for the
 *  single-role data ports that stay unlabelled. This is the SAME vocabulary the
 *  hover tooltips use (`if` / `then` / `else` / `try` / `catch` / `body`), so the
 *  card-edge label, the edge chip and the tooltip can never disagree. A
 *  Condition's second and later predicates read `else if`, mirroring the wording
 *  the expanded branch card already shows; a call's positional args read
 *  `arg 1..n` (1-based) so their order is never ambiguous when a node supplies no
 *  parameter name. */
export const jqPortLabel = (handleId: string | null | undefined): string | null => {
  const role = roleFromHandleId(handleId);
  if (!role || !LABELLED_ROLES.has(role)) return null;
  if (role === 'logic') return 'body';
  if (role === 'if') return handleIndex(handleId) > 0 ? 'else if' : 'if';
  if (role === 'param') return `arg ${String(handleIndex(handleId) + 1)}`;
  return role;
};

/** Look up the tooltip for a handle by its owning node kind and its id. Tries the
 *  kind-specific wording first, then the generic role wording. */
export const getJqHandleTooltip = (
  nodeType: JQNodeType,
  handleId: string | null | undefined,
): HandleTooltip | null => {
  const role = roleFromHandleId(handleId);
  if (!role) return null;
  return T[`${nodeType}:${role}`] ?? GENERIC[role] ?? null;
};

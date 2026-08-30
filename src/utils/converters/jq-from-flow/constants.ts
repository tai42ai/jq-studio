/**
 * @fileoverview Constants for JQ from Flow converter.
 */

import { JQHandleIdPrefix } from '../../../enums';

/**
 * Maximum number of nodes a graph may hold.
 *
 * A conversion walks every node the graph connects, so this caps how much work a
 * single conversion can be asked to do. A chain that loops back on itself is a
 * separate matter, ended by `enterChainNode` rather than by this limit.
 */
export const MAX_GRAPH_NODES = 1000;

/**
 * Regular expression for valid jq variable names.
 * Must start with a letter or underscore, followed by letters, digits, or underscores.
 */
export const VALID_VARIABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Handle ID prefixes that indicate side handle connections (inline expressions).
 * These connections do NOT create variables in the expression chain.
 */
export const SIDE_HANDLE_PREFIXES = [
  JQHandleIdPrefix.Param,
  JQHandleIdPrefix.Item,
  JQHandleIdPrefix.Field,
  JQHandleIdPrefix.If,
  JQHandleIdPrefix.Then,
  JQHandleIdPrefix.OperatorLeft,
  JQHandleIdPrefix.OperatorRight,
  JQHandleIdPrefix.Root,
  JQHandleIdPrefix.Try,
  JQHandleIdPrefix.Catch,
];

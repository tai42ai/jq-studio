/**
 * @fileoverview Constants for JQ to Flow converter.
 */

/**
 * Maximum length of jq expression to prevent parsing overload.
 */
export const MAX_EXPRESSION_LENGTH = 10000;

/**
 * Layout configuration for node positioning.
 */
export const LAYOUT_CONFIG = {
  /** Vertical gap between flow-connected nodes (pipe chains) */
  LAYER_SPACING: 50,
  /** Minimum spacing between any two nodes */
  NODE_MIN_SPACING: 40,
  /** Default node width for layout calculations (pixels) */
  NODE_BASE_WIDTH: 240,
  /** Default node height for layout calculations (pixels) */
  NODE_BASE_HEIGHT: 100,
  /** Horizontal gap from parent right edge to branch sub-tree */
  BRANCH_OFFSET_X: 300,
  /** Vertical gap between stacked branch sub-trees */
  BRANCH_GAP_Y: 20,
  /** Horizontal gap between operator and its operands */
  OPERAND_GAP: 80,
  /** Horizontal offset: Start → FunctionDecl */
  FUNCTION_DECL_OFFSET_X: 350,
  /** Vertical gap between multiple FunctionDecl nodes */
  FUNCTION_DECL_GAP_Y: 150,
  /** Horizontal offset: FunctionDecl → body sub-graph */
  FUNCTION_LOGIC_OFFSET_X: 300,
  /** Top padding / initial Y position */
  START_Y: 50,
  /** Canvas padding around the entire graph */
  PADDING: 50,
  /** Maximum iterations for collision resolution */
  COLLISION_MAX_ITERATIONS: 10,
};

/**
 * Per-node-type colour tokens for the jq transformer canvas, derived from the
 * jq kind registry (the single source for per-kind identity).
 *
 * Every colour is a design-system custom property (`var(--jq-color-*)`) so the
 * canvas themes itself with the host (light/dark) and no colour is hardcoded.
 * The token palette is small, so a few node types share a hue — their icon,
 * label, shape modifier, and badge carry the rest of the distinction. The
 * gradient edge, handles, node chrome, and minimap all read these.
 */
import { JQNodeType } from './enums';
import { JQ_KIND_REGISTRY } from './jq-kind-registry';

export const jqNodeColorVar: Record<JQNodeType, string> = Object.fromEntries(
  Object.values(JQNodeType).map((type) => [type, JQ_KIND_REGISTRY[type].color]),
) as Record<JQNodeType, string>;

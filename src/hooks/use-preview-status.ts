/**
 * Derives what a jq expression's read-only preview should show: the parsed graph
 * once proven faithful, or a placeholder verdict (unfaithful, still-checking,
 * unrepresentable, invalid, or nothing to draw). The graph is withheld behind a
 * "checking" state until the faithfulness guard proves the round-trip matches.
 */
import { useEffect, useMemo, useState } from 'react';

import type { JQEdge, JQNode } from '../types';
import { roundTripVerdict } from '../utils/converters/faithfulness-guard';
import { convertJQToFlow } from '../utils/converters/flow-from-jq';
import { checkJqValidity, type JqValidity } from '../utils/jq-loader';

export type PreviewStatus =
  | { kind: 'graph' }
  | { kind: 'unfaithful' }
  | { kind: 'checking' }
  | { kind: 'unrepresentable'; construct: string | null }
  | { kind: 'invalid' }
  | { kind: 'placeholder'; headline: string; showEmptyHint: boolean };

export interface PreviewState {
  nodes: JQNode[];
  edges: JQEdge[];
  status: PreviewStatus;
}

/** Pulls the offending fragment out of the converter's "Unable to parse jq
 *  expression: X" message so the neutral notice can name what it could not draw.
 *  Returns null for any other message, and trims an over-long fragment. */
const blockingConstruct = (error: string | null): string | null => {
  if (error === null) return null;
  const match = /Unable to parse jq expression:\s*([\s\S]+)$/.exec(error);
  const fragment = match?.[1]?.trim();
  if (!fragment) return null;
  return fragment.length > 80 ? `${fragment.slice(0, 79)}…` : fragment;
};

const resolveStatus = (
  hasNodes: boolean,
  parsed: boolean,
  faithful: 'checking' | 'faithful' | 'unfaithful' | 'invalid',
  drawFailed: boolean,
  validity: JqValidity | 'checking',
  error: string | null,
  hasExpression: boolean,
): PreviewStatus => {
  if (hasNodes && faithful === 'faithful') return { kind: 'graph' };
  // The oracle's binder rejected the declared names (reserved/malformed): the
  // expression cannot compile with them, the same loud invalid the validity door
  // raises when the drawing fails.
  if (parsed && faithful === 'invalid') return { kind: 'invalid' };
  if (parsed && faithful === 'unfaithful') return { kind: 'unfaithful' };
  if (parsed && faithful === 'checking') return { kind: 'checking' };
  if (drawFailed && validity === 'valid') {
    return { kind: 'unrepresentable', construct: blockingConstruct(error) };
  }
  if (drawFailed && validity === 'invalid') return { kind: 'invalid' };
  const headline = drawFailed
    ? 'Checking expression…'
    : hasExpression
      ? 'Empty graph'
      : 'No expression yet';
  return { kind: 'placeholder', headline, showEmptyHint: !drawFailed };
};

export const usePreviewStatus = (
  expression: string,
  declaredVariables: readonly string[] = [],
): PreviewState => {
  // A stable key so the effects and memo below re-run when the accepted roots
  // change, without a new array identity per render forcing a needless recompute.
  const declaredKey = [...declaredVariables].sort().join(',');
  const result = useMemo(() => {
    if (!expression.trim()) return { nodes: [], edges: [], error: null as string | null };
    try {
      const { nodes, edges } = convertJQToFlow(expression, declaredVariables);
      return { nodes, edges, error: null as string | null };
    } catch (e) {
      return { nodes: [], edges: [], error: e instanceof Error ? e.message : 'parse error' };
    }
    // `declaredKey` stands in for `declaredVariables` (a fresh array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, declaredKey]);

  // The graph converter answers ONE question — can the visual editor draw this? —
  // and a "no" (`result.error`) does NOT mean the jq is broken. Runtime validity is
  // a SEPARATE signal, consulted only when the drawing failed, to tell a genuinely
  // malformed expression (loud) apart from valid jq the editor cannot draw (neutral).
  const drawFailed = result.error !== null && expression.trim() !== '';
  const [validity, setValidity] = useState<JqValidity | 'checking'>('checking');
  useEffect(() => {
    if (!drawFailed) return;
    let cancelled = false;
    setValidity('checking');
    void checkJqValidity(expression, declaredVariables).then(
      (next) => {
        if (!cancelled) setValidity(next);
      },
      () => {
        // The binder refuses a reserved or malformed declared name; surface that
        // as the loud invalid verdict rather than leaving the preview checking.
        if (!cancelled) setValidity('invalid');
      },
    );
    return () => {
      cancelled = true;
    };
    // `declaredKey` stands in for `declaredVariables` (a fresh array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, drawFailed, declaredKey]);

  // A parse that SUCCEEDED is not enough to draw: the graph must also read back to
  // the SAME jq. The faithfulness guard serialises the parsed graph and compares
  // behaviour through the WASM oracle; an unfaithful reading is treated exactly
  // like the unrepresentable case, so a mis-parsed graph is never drawn (and never
  // becomes the thing a later save writes back). The check is async, so the graph
  // is withheld behind a neutral "checking" placeholder until it is proven faithful.
  const parsed = result.error === null && result.nodes.length > 0;
  const [faithful, setFaithful] = useState<'checking' | 'faithful' | 'unfaithful' | 'invalid'>(
    'checking',
  );
  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    setFaithful('checking');
    void roundTripVerdict(expression, declaredVariables).then(
      (verdict) => {
        // `unparseable` cannot occur here (the graph parsed); fold it into the
        // safe side (do not draw) alongside `unfaithful`.
        if (!cancelled) setFaithful(verdict === 'faithful' ? 'faithful' : 'unfaithful');
      },
      () => {
        // The binder refuses a reserved or malformed declared name inside the
        // oracle; surface that as the loud invalid state, matching the validity
        // door, rather than leaving the check spinning on "checking".
        if (!cancelled) setFaithful('invalid');
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, parsed, declaredKey]);

  const status = resolveStatus(
    result.nodes.length > 0,
    parsed,
    faithful,
    drawFailed,
    validity,
    result.error,
    expression.trim() !== '',
  );

  return { nodes: result.nodes, edges: result.edges, status };
};

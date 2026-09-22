/**
 * The canvas's initial-load handshake. The canvas mounts with an EMPTY graph,
 * which `convertFlowToJQ` refuses, so the first `onChange` would emit that
 * placeholder BEFORE the async load adopts the real graph — and the surrounding
 * dialog would pin the placeholder as its dirty baseline. Holding emissions until
 * the load has SETTLED (graph adopted, a fallback reached, or nothing to load)
 * means the first expression the dialog sees is the graph's first REAL
 * serialization. Adoption waits on the faithfulness guard: the graph is taken
 * only once proven to round-trip to the same behaviour.
 */
import type { Edge, Node } from '@xyflow/react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { JQEdge, JQNode, JQNodeData } from '../types';
import { roundTripVerdict } from '../utils/converters/faithfulness-guard';
import { convertJQToFlow } from '../utils/converters/flow-from-jq';

interface InitialLoadParams {
  initialExpression: string | undefined;
  /** Names (without `$`) of variables the host binds beside `.`; passed to
   *  the converter and the faithfulness guard so an expression that reads one is
   *  drawn rather than pushed to the text fallback. */
  declaredVariables: readonly string[];
  setNodes: Dispatch<SetStateAction<Node<JQNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  nodeCountersRef: RefObject<Record<string, number>>;
  scheduleFit: () => void;
}

export interface InitialLoadState {
  /** The loaded expression's graph read back to DIFFERENT jq — show the neutral
   *  fallback instead of the mis-read graph. */
  entryUnfaithful: boolean;
  /** The loaded jq could not be turned into a graph at all. */
  parseFailed: boolean;
  /** The load has settled, so `onChange` emissions may begin. */
  initialLoadSettled: boolean;
  /** The author's explicit opt-in to discard the loaded expression and start blank. */
  startEmpty: () => void;
}

export const useInitialLoad = ({
  initialExpression,
  declaredVariables,
  setNodes,
  setEdges,
  nodeCountersRef,
  scheduleFit,
}: InitialLoadParams): InitialLoadState => {
  const [entryUnfaithful, setEntryUnfaithful] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [initialLoadSettled, setInitialLoadSettled] = useState(false);

  // Load the initial expression once on mount (the dialog remounts the canvas
  // on each open, so this runs fresh per open).
  useEffect(() => {
    // An empty field has no graph to load: settle at once so a from-scratch
    // canvas still emits (its empty-graph state IS the honest baseline — a first
    // node the author then adds is a real edit that SHOULD prompt on close).
    if (!initialExpression?.trim()) {
      setInitialLoadSettled(true);
      return;
    }
    let loaded: { nodes: JQNode[]; edges: JQEdge[] };
    try {
      loaded = convertJQToFlow(initialExpression, declaredVariables);
    } catch (e) {
      // A parse failure must NOT silently blank the canvas (a later one-node save
      // would overwrite the author's expression). Surface the fallback instead.
      console.error('[TransformerCanvas] Failed to load initial expression:', e);
      setParseFailed(true);
      setInitialLoadSettled(true);
      return;
    }
    let cancelled = false;
    void roundTripVerdict(initialExpression, declaredVariables)
      .then((verdict) => {
        if (cancelled) return;
        if (verdict === 'unfaithful') {
          setEntryUnfaithful(true);
          setInitialLoadSettled(true);
          return;
        }
        setNodes(loaded.nodes);
        setEdges(loaded.edges);
        nodeCountersRef.current = {};
        scheduleFit();
        // Settle only now the real graph is committed, so the FIRST emission the
        // dialog captures as baseline is this graph's serialization.
        setInitialLoadSettled(true);
      })
      .catch(() => {
        // The verdict path is rejection-safe today, but the settle invariant — the
        // flag ALWAYS settles, or the editor would never report a change — must
        // not hinge on that staying true.
        if (!cancelled) setInitialLoadSettled(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The author's explicit opt-in to discard the loaded expression and build
  // afresh — the ONLY path from either non-destructive fallback to an editable
  // (blank) canvas. Until it is taken, the original text is preserved verbatim.
  const startEmpty = useCallback(() => {
    setParseFailed(false);
    setEntryUnfaithful(false);
  }, []);

  return { entryUnfaithful, parseFailed, initialLoadSettled, startEmpty };
};

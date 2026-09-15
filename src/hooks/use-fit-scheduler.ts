/**
 * Schedules a fit-to-view after a graph swap. Two nested animation frames — the
 * first lets React commit the new nodes, the second lets xyflow measure them —
 * so `fitView` frames the loaded layout instead of racing commit/measure on a
 * wall-clock timer. The live instance is mirrored in a ref so a fit queued from
 * an effect that captured a null instance still reaches the live one at frame time.
 */
import type { Node, ReactFlowInstance } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

import type { JQNodeData } from '../types';

export interface FitScheduler {
  instanceRef: React.RefObject<ReactFlowInstance<Node<JQNodeData>> | null>;
  scheduleFit: () => void;
}

export const useFitScheduler = (): FitScheduler => {
  const instanceRef = useRef<ReactFlowInstance<Node<JQNodeData>> | null>(null);
  const fitRafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (fitRafRef.current !== null) cancelAnimationFrame(fitRafRef.current);
    },
    [],
  );

  const scheduleFit = useCallback((): void => {
    if (fitRafRef.current !== null) cancelAnimationFrame(fitRafRef.current);
    fitRafRef.current = requestAnimationFrame(() => {
      fitRafRef.current = requestAnimationFrame(() => {
        fitRafRef.current = null;
        instanceRef.current?.fitView({ padding: 0.2, duration: 800 }).catch((error: unknown) => {
          console.error('[TransformerCanvas] Failed to fit the loaded graph to view:', error);
        });
      });
    });
  }, []);

  return { instanceRef, scheduleFit };
};

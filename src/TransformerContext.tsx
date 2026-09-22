import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

import { type JQNodeType } from './enums';
import { type TransformerConnectionState } from './types';

/** Drops a new node of `type` onto the canvas — the palette's click-to-add path. */
type AddNodeFn = (type: JQNodeType) => void;

interface TransformerContextType {
  connectionState: TransformerConnectionState;
  startConnection: (state: Omit<TransformerConnectionState, 'isConnecting'>) => void;
  endConnection: () => void;
  readOnly: boolean;
  /** Add a node of `type` at the viewport centre (no-op until the canvas registers
   *  its handler). The palette calls this so a click (or Enter/Space) adds a node
   *  without a drag — the canvas owns the placement because it holds the flow
   *  instance the palette sits outside of. */
  addNode: AddNodeFn;
  /** The canvas registers (and, on unmount, clears) the real add-node handler. */
  registerAddNode: (fn: AddNodeFn | null) => void;
  /** Names (without `$`) of the variables the host binds beside `.` — offered
   *  as path roots alongside `.` and the preceding named nodes. */
  declaredVariables: readonly string[];
}

const initialState: TransformerConnectionState = {
  isConnecting: false,
  sourceNodeId: null,
  sourceNodeType: null,
  sourceHandleId: null,
  sourceHandleType: null,
  edges: [],
};

const TransformerContext = createContext<TransformerContextType | null>(null);

export const TransformerProvider = ({
  children,
  readOnly = false,
  declaredVariables = [],
}: {
  children: ReactNode;
  readOnly?: boolean;
  declaredVariables?: readonly string[];
}) => {
  const [connectionState, setConnectionState] = useState<TransformerConnectionState>(initialState);
  const addNodeRef = useRef<AddNodeFn | null>(null);

  const startConnection = useCallback((state: Omit<TransformerConnectionState, 'isConnecting'>) => {
    setConnectionState({ ...state, isConnecting: true });
  }, []);

  const endConnection = useCallback(() => {
    setConnectionState(initialState);
  }, []);

  const registerAddNode = useCallback((fn: AddNodeFn | null) => {
    addNodeRef.current = fn;
  }, []);

  const addNode = useCallback<AddNodeFn>((type) => {
    addNodeRef.current?.(type);
  }, []);

  return (
    <TransformerContext.Provider
      value={{
        connectionState,
        startConnection,
        endConnection,
        readOnly,
        addNode,
        registerAddNode,
        declaredVariables,
      }}
    >
      {children}
    </TransformerContext.Provider>
  );
};

export const useTransformerConnection = () => {
  const context = useContext(TransformerContext);
  if (!context) {
    throw new Error('useTransformerConnection must be used within TransformerProvider');
  }
  return context;
};

export const useTransformerReadOnly = () => {
  const context = useContext(TransformerContext);
  return context?.readOnly ?? false;
};

/** The variables the host binds beside `.`, offered as path roots. Empty
 *  outside a provider or when the field declares none. */
export const useDeclaredVariables = (): readonly string[] => {
  const context = useContext(TransformerContext);
  return context?.declaredVariables ?? [];
};

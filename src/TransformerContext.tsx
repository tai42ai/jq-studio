import { createContext, useContext, useState, type ReactNode, useCallback, useRef } from 'react';
import { type TransformerConnectionState } from './types';
import { type JQNodeType } from './enums';

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
}: {
  children: ReactNode;
  readOnly?: boolean;
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

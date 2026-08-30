import { createContext, useContext } from 'react';

const SnapshotContext = createContext<(() => void) | null>(null);

export const SnapshotProvider = SnapshotContext.Provider;

export function useSnapshot(): () => void {
  const fn = useContext(SnapshotContext);
  if (!fn) throw new Error('useSnapshot must be used within SnapshotProvider');
  return fn;
}

/**
 * Notifies a host on every NET-COMMITTED transition of the editor's open state,
 * plus on unmount-while-open. A host with global keyboard shortcuts uses this to
 * mute them while the editor is open (a keydown bubbles to `window` even from a
 * focus-trapped modal). Keying off the single `open` state means no open/close
 * route can slip past the notify; the ref-guard skips the mount frame so
 * StrictMode's double-invoked mount yields no spurious call.
 */
import { useEffect, useRef } from 'react';

export const useEditorOpenNotifier = (
  open: boolean,
  onEditorOpenChange?: (open: boolean) => void,
): void => {
  const previousOpenRef = useRef(open);
  useEffect(() => {
    if (previousOpenRef.current !== open) {
      previousOpenRef.current = open;
      onEditorOpenChange?.(open);
    }
  }, [open, onEditorOpenChange]);

  // An empty-dep unmount cleanup captures its closure at mount, so it reaches the
  // CURRENT open state and callback through refs rather than stale mount values.
  const openRef = useRef(open);
  const onEditorOpenChangeRef = useRef(onEditorOpenChange);
  useEffect(() => {
    openRef.current = open;
    onEditorOpenChangeRef.current = onEditorOpenChange;
  });

  // Unmount counts as a close for the muting contract: tearing the field down
  // while the editor is open runs none of the normal close paths, so without this
  // a host would leave its global shortcuts muted. Empty deps fire this ONLY at
  // unmount; a normal close flips `open` to false first, so `openRef` reads false.
  useEffect(
    () => () => {
      if (openRef.current) onEditorOpenChangeRef.current?.(false);
    },
    [],
  );
};

/**
 * Small presentational helpers shared by the transformer node editors: a
 * compact field label and an info tooltip. The tooltip content re-stamps the
 * library root class because the primitives `Tooltip` portals outside the library
 * root subtree.
 */
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from './primitives';

export function NodeLabel({ children }: { children: ReactNode }): ReactNode {
  return <span className="jqs-jq-label">{children}</span>;
}

export function InfoTooltip({ text }: { text: string }): ReactNode {
  return (
    <Tooltip content={<div className="jq-studio-root jqs-jq-tooltip">{text}</div>}>
      <Info className="jqs-jq-info-icon" aria-label="More information" />
    </Tooltip>
  );
}

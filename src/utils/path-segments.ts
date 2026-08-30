/**
 * Compiles a Value node's structured path segments into a jq path expression.
 *
 * Shared by the Path value editor (which builds the segments) and the
 * flow-to-jq generator (which reads them), so the pure compilation logic lives
 * apart from the React editor.
 */
import type { PathSegment } from '../types';

export const compilePathSegments = (segments: PathSegment[]): string => {
  let result = '';
  for (const seg of segments) {
    switch (seg.type) {
      case 'root':
        result = '.';
        break;
      case 'node_ref':
        result = `$${seg.value}`;
        break;
      case 'field':
        result += `.${seg.value}`;
        break;
      case 'index':
        result += `[${seg.value}]`;
        break;
      case 'range':
        result += `[${seg.value}:${seg.rangeEnd ?? ''}]`;
        break;
    }
  }
  // Paths must start with '.' — ensure a leading dot for paths that open with
  // an [index] or [range] segment.
  if (result && !result.startsWith('.') && !result.startsWith('$')) {
    result = '.' + result;
  }
  return result.replaceAll('..', '.') || '.';
};

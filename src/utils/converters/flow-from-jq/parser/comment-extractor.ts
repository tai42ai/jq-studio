/**
 * @fileoverview Splits the comments a jq chain segment owns from its expression text.
 *
 * A `#` comment runs to the end of its line unless the `#` sits inside a string
 * literal. A comment that precedes every expression character of the segment, or
 * follows the last one, annotates the chain that segment is a stage of, so the
 * parser turns it into a Comment node of that chain. A comment between the two
 * belongs to a chain some nested construct builds — an `if` branch, a call
 * argument, an array item — and is left in the text for the parser that slices
 * that construct apart.
 *
 * Comments in the same group merge into one newline-separated text, which is how
 * a multiline Comment node renders.
 */

/** A `#` comment and the span it occupies in the segment. */
interface CommentSpan {
  start: number;
  text: string;
}

export interface ChainSegmentComments {
  /** Merged text of the comments before the segment's expression, or null if there are none. */
  leading: string | null;
  /** The segment's expression text, with the comments inside it left in place. */
  core: string;
  /** Merged text of the comments after the segment's expression, or null if there are none. */
  trailing: string | null;
}

/**
 * Merges a group of comment texts into one Comment node's text, dropping the
 * empty ones — a bare `#` carries no text to show.
 */
function mergeCommentTexts(spans: CommentSpan[]): string | null {
  const texts = spans.map((span) => span.text).filter((text) => text !== '');
  return texts.length > 0 ? texts.join('\n') : null;
}

/**
 * Splits a pipe-free chain segment into the comments that annotate the chain and
 * the expression text between them.
 *
 * @param segment - One stage of a pipe chain, as written
 * @returns The segment's leading comments, its expression text, and its trailing comments
 *
 * @example
 * splitChainComments('.field # note')
 * // Returns: { leading: null, core: '.field', trailing: 'note' }
 * splitChainComments('if .c then .a # note\nelse .b end')
 * // Returns: { leading: null, core: 'if .c then .a # note\nelse .b end', trailing: null }
 */
export function splitChainComments(segment: string): ChainSegmentComments {
  const comments: CommentSpan[] = [];
  let firstExpression = -1;
  let lastExpression = -1;
  let inString = false;
  let escapeNext = false;

  const markExpression = (index: number) => {
    if (firstExpression === -1) firstExpression = index;
    lastExpression = index;
  };

  for (let i = 0; i < segment.length; i++) {
    const char = segment[i] ?? '';

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      markExpression(i);
      continue;
    }

    if (char === '"') {
      inString = true;
      markExpression(i);
      continue;
    }

    if (char === '#') {
      const lineEnd = segment.indexOf('\n', i);
      const end = lineEnd === -1 ? segment.length : lineEnd;
      comments.push({ start: i, text: segment.substring(i + 1, end).trim() });
      i = end - 1;
      continue;
    }

    if (!/\s/.test(char)) {
      markExpression(i);
    }
  }

  if (firstExpression === -1) {
    return { leading: mergeCommentTexts(comments), core: '', trailing: null };
  }

  return {
    leading: mergeCommentTexts(comments.filter((span) => span.start < firstExpression)),
    core: segment.substring(firstExpression, lastExpression + 1),
    trailing: mergeCommentTexts(comments.filter((span) => span.start > lastExpression)),
  };
}

/**
 * @fileoverview Parsing utility functions.
 *
 * Includes complete string unescaping with unicode support.
 */

/**
 * Index the `#` comment starting at `index` ends at — the last character before
 * its line break, or the last character of the string when it has none.
 *
 * A jq comment runs to the end of its line, so everything it holds is text the
 * scanners must step over: an operator, a delimiter or a keyword written inside
 * one is not part of the expression.
 */
export function commentEnd(str: string, index: number): number {
  const lineEnd = str.indexOf('\n', index);
  return (lineEnd === -1 ? str.length : lineEnd) - 1;
}

/**
 * Reports whether `keyword` stands as a whole word at `index`.
 *
 * The character before must not extend it into an identifier, a field (`.end`)
 * or a variable (`$end`), and the character after must not extend it either —
 * `endswith` opens with `end` and is a function, not the closer of an `if`.
 */
function keywordAt(str: string, index: number, keyword: string): boolean {
  if (!str.startsWith(keyword, index)) return false;
  const before = index === 0 ? '' : (str[index - 1] ?? '');
  const after = str[index + keyword.length] ?? '';
  return !/[\w.$]/.test(before) && !/\w/.test(after);
}

/**
 * Index of the first character at or after `index` that is neither whitespace
 * nor comment text, or `str.length` when none remains.
 */
function nextSignificantIndex(str: string, index: number): number {
  let i = index;
  while (i < str.length) {
    const char = str[i] ?? '';
    if (char === '#') {
      i = commentEnd(str, i) + 1;
      continue;
    }
    if (!/\s/.test(char)) return i;
    i++;
  }
  return str.length;
}

/**
 * Reports whether the whole word `keyword` at `index` is jq's control keyword
 * rather than the key of an object field.
 *
 * jq accepts a keyword as an unquoted key (`{end: .e}`, `{if: 1}`), where the
 * pair's `:` always follows it; a control keyword is never followed by one, so
 * a scanner counting `if … end` as a nesting level must skip the key.
 */
export function controlKeywordAt(str: string, index: number, keyword: string): boolean {
  if (!keywordAt(str, index, keyword)) return false;
  return str[nextSignificantIndex(str, index + keyword.length)] !== ':';
}

/**
 * Finds the index of a top-level operator (not inside brackets/parentheses/strings/comments).
 *
 * This is crucial for correctly parsing expressions with nested structures.
 *
 * @param str - String to search
 * @param operator - Operator to find
 * @returns Index of operator, or -1 if not found
 *
 * @example
 * findTopLevelOperator("a | (b | c)", "|"); // Returns: 2 (first pipe, not the one in parentheses)
 */
export function findTopLevelOperator(str: string, operator: string): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '#') {
      i = commentEnd(str, i);
      continue;
    }

    // `if … end` delimits its branches the way brackets delimit their contents:
    // the operators inside one belong to a branch, not to this level
    if (controlKeywordAt(str, i, 'if')) {
      depth++;
      i += 1;
      continue;
    }
    if (controlKeywordAt(str, i, 'end')) {
      depth--;
      i += 2;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    } else if (depth === 0 && str.substring(i).startsWith(operator)) {
      // Check if it's a word operator (and, or, not)
      if (/^\w+$/.test(operator)) {
        const before = i === 0 || /\s/.test(str[i - 1] ?? '');
        const after =
          i + operator.length >= str.length || /\s/.test(str[i + operator.length] ?? '');
        if (before && after) {
          return i;
        }
      } else {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Finds the index of the `)` that closes the `(` at `openIndex`, stepping over
 * strings, comments and nested brackets the way the top-level scanners do.
 *
 * @param str - String to scan
 * @param openIndex - Index of the opening parenthesis
 * @returns Index of the matching close paren, or -1 when it never closes
 */
export function matchingCloseParen(str: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = openIndex; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '#') {
      i = commentEnd(str, i);
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * Splits a string by delimiter at top level (not inside brackets/parentheses/strings/comments).
 *
 * Comment text is kept in the part it was written in — the parser that reads the
 * part decides which chain the comment annotates.
 *
 * @param str - String to split
 * @param delimiter - Delimiter character
 * @returns Array of split parts
 *
 * @example
 * splitTopLevel("[1, [2, 3]], 4", ","); // Returns: ["[1, [2, 3]]", " 4"]
 */
export function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i] ?? '';

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      continue;
    }

    if (char === '#') {
      const end = commentEnd(str, i);
      current += str.substring(i, end + 1);
      i = end;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (depth === 0 && char === delimiter) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}

/**
 * Unescapes a jq string literal.
 *
 * Handles complete unicode escape sequences.
 *
 * Handles all jq escape sequences:
 * - \\  → Backslash
 * - \"  → Double quote
 * - \n  → Newline
 * - \r  → Carriage return
 * - \t  → Tab
 * - \f  → Form feed
 * - \b  → Backspace
 * - \v  → Vertical tab
 * - \uXXXX → Unicode character
 *
 * @param str - Escaped string content
 * @returns Unescaped string
 *
 * @example
 * unescapeString('Hello\\nWorld'); // Returns: 'Hello\nWorld'
 * unescapeString('\\u0041'); // Returns: 'A'
 */
export function unescapeString(str: string): string {
  return (
    str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\f/g, '\f') // Form feed
      .replace(/\\b/g, '\b') // Backspace
      .replace(/\\v/g, '\v') // Vertical tab
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      // Unicode escape sequences
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => {
        return String.fromCharCode(parseInt(hex, 16));
      })
  );
}

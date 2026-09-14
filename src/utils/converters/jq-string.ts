/**
 * @fileoverview The jq string-literal escape codec — the one place that maps
 * between a raw string value and its escaped form inside `"…"`.
 *
 * Both directions cover the same set: `\\`, `\"`, `\n`, `\r`, `\t`, `\f`, `\b`,
 * `\v` and `\uXXXX` for non-ASCII characters.
 */

/**
 * Escapes a raw string for use inside a jq `"…"` literal.
 *
 * Backslashes are escaped first so the escapes introduced afterwards are not
 * doubled, and every non-ASCII character becomes a `\uXXXX` sequence.
 *
 * @param str - The raw string to escape
 * @returns The escaped body, without the surrounding quotes
 *
 * @example
 * escapeJqString('Hello\nWorld'); // Returns: 'Hello\\nWorld'
 * escapeJqString('Quote: "test"'); // Returns: 'Quote: \\"test\\"'
 * escapeJqString('Unicode: A'); // Returns: 'Unicode: \\u0041'
 */
export function escapeJqString(str: string): string {
  return (
    str
      .replace(/\\/g, '\\\\') // Backslash (must be first)
      .replace(/"/g, '\\"') // Double quote
      .replace(/\n/g, '\\n') // Newline
      .replace(/\r/g, '\\r') // Carriage return
      .replace(/\t/g, '\\t') // Tab
      .replace(/\f/g, '\\f') // Form feed
      // eslint-disable-next-line no-control-regex
      .replace(/\x08/g, '\\b') // Backspace (actual ASCII 8)
      .replace(/\v/g, '\\v') // Vertical tab
      // Unicode escape for non-ASCII characters
      .replace(/[\u0080-\uFFFF]/g, (char) => {
        const code = char.charCodeAt(0).toString(16).padStart(4, '0');
        return `\\u${code}`;
      })
  );
}

/**
 * Unescapes the body of a jq `"…"` literal back to its raw string value,
 * resolving `\uXXXX` sequences to their character.
 *
 * @param str - The escaped body, without the surrounding quotes
 * @returns The raw string
 *
 * @example
 * unescapeJqString('Hello\\nWorld'); // Returns: 'Hello\nWorld'
 * unescapeJqString('\\u0041'); // Returns: 'A'
 */
export function unescapeJqString(str: string): string {
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

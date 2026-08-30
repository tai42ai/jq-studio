/**
 * @fileoverview String utilities for JQ expression generation.
 *
 * Complete escape handling including unicode.
 */

/**
 * Escapes special characters in a string for jq string literals.
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
 * - \uXXXX → Unicode escape (for non-ASCII characters)
 *
 * @param str - The string to escape
 * @returns The escaped string
 *
 * @example
 * escapeStringLiteral('Hello\nWorld'); // Returns: 'Hello\\nWorld'
 * escapeStringLiteral('Quote: "test"'); // Returns: 'Quote: \\"test\\"'
 * escapeStringLiteral('Unicode: \u0041'); // Returns: 'Unicode: \\u0041'
 */
export function escapeStringLiteral(str: string): string {
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

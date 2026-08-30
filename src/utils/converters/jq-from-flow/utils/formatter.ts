/**
 * Formatting utilities for JQ expression generation
 * Provides functions for indentation, line breaks, and smart formatting
 */

/**
 * Number of spaces per indentation level
 */
export const INDENT_SIZE = 2;

/**
 * Maximum number of items to keep inline before formatting across multiple lines
 */
export const MAX_INLINE_ITEMS = 3;

/**
 * Creates an indentation string for the given nesting level
 * @param level - The indentation level (0 = no indent)
 * @returns A string of spaces for indentation
 */
export function makeIndent(level: number): string {
  return ' '.repeat(level * INDENT_SIZE);
}

/**
 * Checks if a string contains newlines (indicates a complex/multiline expression)
 * @param str - The string to check
 * @returns true if the string contains newlines
 */
export function isMultiline(str: string): boolean {
  return str.includes('\n');
}

/**
 * Determines if an array/object should be formatted across multiple lines
 * Uses smart formatting: formats if > MAX_INLINE_ITEMS or any item is multiline
 * @param items - Array of item/field strings
 * @returns true if should format with line breaks
 */
export function shouldFormatMultiline(items: string[]): boolean {
  return items.length > MAX_INLINE_ITEMS || items.some(isMultiline);
}

/**
 * Formats an array with proper indentation
 * Simple arrays stay inline, complex arrays get line breaks
 * @param items - Array item expressions
 * @param indent - Current indentation level
 * @returns Formatted array string
 */
export function formatArray(items: string[], indent: number): string {
  if (items.length === 0) return '[]';

  if (!shouldFormatMultiline(items)) {
    // Keep inline for simple arrays
    return `[${items.join(', ')}]`;
  }

  // Multi-line format
  const innerIndent = makeIndent(indent + 1);
  const outerIndent = makeIndent(indent);
  const formattedItems = items.map((item) => `${innerIndent}${item}`).join(',\n');

  return `[\n${formattedItems}\n${outerIndent}]`;
}

/**
 * Formats an object with proper indentation
 * Simple objects stay inline, complex objects get line breaks
 * @param fields - Object field strings (e.g., '"name": value')
 * @param indent - Current indentation level
 * @returns Formatted object string
 */
export function formatObject(fields: string[], indent: number): string {
  if (fields.length === 0) return '{}';

  if (!shouldFormatMultiline(fields)) {
    // Keep inline for simple objects
    return `{${fields.join(', ')}}`;
  }

  // Multi-line format
  const innerIndent = makeIndent(indent + 1);
  const outerIndent = makeIndent(indent);
  const formattedFields = fields.map((field) => `${innerIndent}${field}`).join(',\n');

  return `{\n${formattedFields}\n${outerIndent}}`;
}

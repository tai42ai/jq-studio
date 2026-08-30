/**
 * @fileoverview General utility functions for JQ to Flow converter.
 */

import { type ConversionContext } from './types';
import { type FunctionDef, functionCategories } from '../../function-registry';

/**
 * Looks up a built-in function by name.
 *
 * @param functionName - Name of the function to look up
 * @param context - Conversion context with function registry
 * @returns Function definition if found, null otherwise
 */
export function lookupBuiltInFunction(
  functionName: string,
  context: ConversionContext,
): FunctionDef | null {
  return context.builtInFunctions.get(functionName) ?? null;
}

/**
 * Initializes the built-in function registry in the conversion context.
 *
 * @param context - Conversion context to initialize
 */
export function initializeBuiltInFunctions(context: ConversionContext): void {
  for (const category of functionCategories) {
    for (const func of category.functions) {
      context.builtInFunctions.set(func.name, func);
    }
  }
}

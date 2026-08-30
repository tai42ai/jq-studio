/**
 * @fileoverview Validation context for the flow builder.
 *
 * Provides per-node validation errors as derived state (via useMemo in the
 * canvas) rather than storing errors on node.data, avoiding infinite
 * re-render loops.
 */

import { createContext, useContext } from 'react';
import { type ValidationError, type ValidationErrorMap } from './utils/flow-validator';

const ValidationContext = createContext<ValidationErrorMap>(new Map());

export const ValidationProvider = ValidationContext.Provider;

/**
 * Returns validation errors for a specific node.
 *
 * @param nodeId - The node ID to look up
 * @returns Array of validation errors (empty if none)
 */
export function useValidationErrors(nodeId: string): ValidationError[] {
  const errorMap = useContext(ValidationContext);
  return errorMap.get(nodeId) ?? [];
}

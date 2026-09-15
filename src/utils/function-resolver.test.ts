/**
 * @fileoverview Tests for the jq function catalog and its resolver lookups.
 */

import { describe, expect, it } from 'vitest';

import type { FunctionDef } from './function-catalog';
import { functionCategories } from './function-catalog';
import {
  getBuiltInFunctionNames,
  getFunctionDefById,
  getFunctionOptions,
  resolveFunctionDef,
  visibleParams,
} from './function-resolver';

const builtins = functionCategories[0]!.functions;

describe('function catalog', () => {
  describe('functionCategories', () => {
    it('should have at least 1 category', () => {
      expect(functionCategories.length).toBeGreaterThanOrEqual(1);
    });

    it('should have unique category IDs', () => {
      const ids = functionCategories.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have unique function IDs globally', () => {
      const allIds = functionCategories.flatMap((c) => c.functions.map((f) => f.id));
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it('lists the builtin functions in the picker-facing order', () => {
      // The FunctionCall picker renders builtins in array order, so the sequence
      // is observable; this pins it (split/join precede the regex ops, the rest
      // of the string ops follow) so a catalog reshuffle cannot silently reorder.
      const expectedOrder = [
        'map',
        'map_values',
        'select',
        'range_1',
        'range_2',
        'range_3',
        'recurse_1',
        'recurse_2',
        'while',
        'until',
        'repeat',
        'inputs',
        'path',
        'paths',
        'leaf_paths',
        'limit',
        'first',
        'last',
        'nth',
        'isempty',
        'all',
        'any',
        'transpose',
        'combinations_0',
        'combinations_1',
        'group_by',
        'sort',
        'sort_by',
        'unique',
        'unique_by',
        'min_by',
        'max_by',
        'length',
        'utf8bytelength',
        'keys',
        'keys_unsorted',
        'has',
        'in',
        'del',
        'tostring',
        'tonumber',
        'fromjson',
        'tojson',
        'type',
        'error',
        'halt',
        'add',
        'split',
        'join',
        'test',
        'match',
        'sub',
        'gsub',
        'startswith',
        'endswith',
        'contains',
        'ascii_downcase',
        'ascii_upcase',
        'now',
        'strftime',
        'strptime',
        'fromdate',
        'todate',
        'floor',
        'sqrt',
        'pow',
        'min',
        'max',
        'debug',
        'stderr',
      ];
      expect(builtins.map((f) => f.id)).toEqual(expectedOrder);
    });

    it('should have non-empty labels and descriptions', () => {
      for (const cat of functionCategories) {
        expect(cat.label.length).toBeGreaterThan(0);
        expect(cat.description.length).toBeGreaterThan(0);
        for (const fn of cat.functions) {
          expect(fn.name.length).toBeGreaterThan(0);
          expect(fn.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getBuiltInFunctionNames', () => {
    it('should return a non-empty array', () => {
      const names = getBuiltInFunctionNames();
      expect(names.length).toBeGreaterThan(0);
    });

    it('should return deduplicated names', () => {
      const names = getBuiltInFunctionNames();
      expect(new Set(names).size).toBe(names.length);
    });

    it('should include known built-in functions', () => {
      const names = getBuiltInFunctionNames();
      expect(names).toContain('map');
      expect(names).toContain('select');
      expect(names).toContain('length');
      expect(names).toContain('keys');
      expect(names).toContain('sort');
    });

    it('should deduplicate overloaded functions like range', () => {
      const names = getBuiltInFunctionNames();
      const rangeCount = names.filter((n) => n === 'range').length;
      expect(rangeCount).toBe(1);
    });
  });

  describe('getFunctionDefById', () => {
    it('should find a function by ID', () => {
      const fn = getFunctionDefById('map');
      expect(fn).not.toBeNull();
      expect(fn!.name).toBe('map');
      expect(fn!.params.length).toBeGreaterThan(0);
    });

    it('should find overloaded functions by specific ID', () => {
      const range1 = getFunctionDefById('range_1');
      const range2 = getFunctionDefById('range_2');
      const range3 = getFunctionDefById('range_3');

      expect(range1).not.toBeNull();
      expect(range2).not.toBeNull();
      expect(range3).not.toBeNull();

      expect(range1!.params).toHaveLength(1);
      expect(range2!.params).toHaveLength(2);
      expect(range3!.params).toHaveLength(3);
    });

    it('should return null for unknown IDs', () => {
      expect(getFunctionDefById('nonexistent')).toBeNull();
      expect(getFunctionDefById('')).toBeNull();
    });

    it('should return function with correct structure', () => {
      const fn = getFunctionDefById('split');
      expect(fn).not.toBeNull();
      expect(fn).toHaveProperty('id', 'split');
      expect(fn).toHaveProperty('name', 'split');
      expect(fn).toHaveProperty('description');
      expect(fn).toHaveProperty('params');
      expect(fn!.params).toHaveLength(1);
      expect(fn!.params[0]!.name).toBe('separator');
    });
  });

  describe('resolveFunctionDef', () => {
    it('matches a single-arity builtin / custom def by exact id', () => {
      expect(resolveFunctionDef(builtins, 'map', 0)?.id).toBe('map');
      expect(resolveFunctionDef(builtins, 'while', 0)?.id).toBe('while');
    });

    it('resolves a multi-arity NAME (as the converter stores it) by connected arity', () => {
      // The converter stores `range`, not `range_2`; without arity resolution
      // this matched no id and the call rendered no ports.
      expect(resolveFunctionDef(builtins, 'range', 1)?.id).toBe('range_1');
      expect(resolveFunctionDef(builtins, 'range', 2)?.id).toBe('range_2');
      expect(resolveFunctionDef(builtins, 'range', 3)?.id).toBe('range_3');
    });

    it('falls back to the highest-arity overload when arity matches none', () => {
      // A fresh, unwired `range` (arity 0) still surfaces ports to connect.
      expect(resolveFunctionDef(builtins, 'range', 0)?.id).toBe('range_3');
    });

    it('returns null for an unknown name or an empty selection', () => {
      expect(resolveFunctionDef(builtins, 'not_a_fn', 2)).toBeNull();
      expect(resolveFunctionDef(builtins, undefined, 2)).toBeNull();
    });
  });

  describe('visibleParams', () => {
    it('shows a bare optional-only call (first, arity 0) with zero ports', () => {
      const first = getFunctionDefById('first');
      expect(visibleParams(first, 0)).toHaveLength(0);
      expect(visibleParams(first, 1)).toHaveLength(1);
    });

    it('always shows required params even when nothing is wired yet', () => {
      const map = getFunctionDefById('map');
      expect(visibleParams(map, 0)).toHaveLength(1);
    });

    it('shows every param of a resolved multi-arity overload', () => {
      expect(visibleParams(resolveFunctionDef(builtins, 'range', 2), 2)).toHaveLength(2);
      expect(visibleParams(resolveFunctionDef(builtins, 'while', 2), 2)).toHaveLength(2);
    });

    it('is empty for a null def', () => {
      expect(visibleParams(null, 3)).toHaveLength(0);
    });
  });

  describe('getFunctionOptions', () => {
    const customFunctions: FunctionDef[] = [
      { id: 'my_fn', name: 'my_fn', description: 'Custom function: my_fn', params: [] },
    ];

    it('returns the catalog functions for a known category id', () => {
      expect(getFunctionOptions('builtin', customFunctions)).toBe(builtins);
    });

    it('returns the flow custom functions for the "custom" call type', () => {
      expect(getFunctionOptions('custom', customFunctions)).toBe(customFunctions);
    });

    it('throws for an unknown call type', () => {
      expect(() => getFunctionOptions('nope', customFunctions)).toThrow(
        /Unknown function call type/,
      );
    });
  });
});

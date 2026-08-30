export interface FunctionParam {
  name: string;
  description: string;
  /** A parameter jq lets you omit — the builtin has a valid ZERO-arg overload
   *  (e.g. `first`/`last`, which without a filter take the first/last value of
   *  the input stream). An omitted optional parameter is not a validation error,
   *  and the serializer emits the bare call (`first`, not `first(.)`). */
  optional?: boolean;
}

export interface FunctionDef {
  id: string;
  name: string;
  description: string;
  params: FunctionParam[];
}

export interface FunctionCategory {
  id: string;
  label: string;
  description: string;
  functions: FunctionDef[];
}

export const functionCategories: FunctionCategory[] = [
  {
    id: 'builtin',
    label: 'Built-in Functions',
    description: 'All jq built-in functions for data transformation, iteration, and manipulation.',
    functions: [
      // Iterator / stream functions
      {
        id: 'map',
        name: 'map',
        description:
          'Applies the filter to each element of the input array and returns the results as a new array.',
        params: [{ name: 'filter', description: 'Filter to apply' }],
      },
      {
        id: 'map_values',
        name: 'map_values',
        description:
          'Applies the filter to each value of the input object and returns the object with updated values.',
        params: [{ name: 'filter', description: 'Filter to apply' }],
      },
      {
        id: 'select',
        name: 'select',
        description:
          'Produces the input unchanged if the condition returns true; otherwise, produces no output.',
        params: [{ name: 'condition', description: 'Condition to evaluate' }],
      },
      {
        id: 'range_1',
        name: 'range',
        description:
          'Generates a sequence of numbers from 0 up to (but not including) the given number.',
        params: [{ name: 'upto', description: 'Upper bound (exclusive)' }],
      },
      {
        id: 'range_2',
        name: 'range',
        description:
          "Generates a sequence of numbers from 'from' up to (but not including) 'upto'.",
        params: [
          { name: 'from', description: 'Start value' },
          { name: 'upto', description: 'Upper bound (exclusive)' },
        ],
      },
      {
        id: 'range_3',
        name: 'range',
        description:
          "Generates a sequence of numbers starting at 'from', incrementing by 'by', up to 'upto'.",
        params: [
          { name: 'from', description: 'Start value' },
          { name: 'upto', description: 'Upper bound (exclusive)' },
          { name: 'by', description: 'Step increment' },
        ],
      },
      {
        id: 'recurse_1',
        name: 'recurse',
        description:
          'Recursively applies the filter to the input, producing a stream of all intermediate results.',
        params: [{ name: 'filter', description: 'Filter to apply recursively' }],
      },
      {
        id: 'recurse_2',
        name: 'recurse',
        description: 'Recursively applies the filter while the condition is met.',
        params: [
          { name: 'filter', description: 'Filter to apply' },
          { name: 'condition', description: 'Condition to continue' },
        ],
      },
      {
        id: 'while',
        name: 'while',
        description:
          'Repeatedly applies the update filter to the input as long as the condition is true.',
        params: [
          { name: 'condition', description: 'Condition to check' },
          { name: 'update', description: 'Update filter' },
        ],
      },
      {
        id: 'until',
        name: 'until',
        description: 'Applies the update filter to the input until the condition becomes true.',
        params: [
          { name: 'condition', description: 'Condition to check' },
          { name: 'update', description: 'Update filter' },
        ],
      },
      {
        id: 'repeat',
        name: 'repeat',
        description: 'Indefinitely outputs the values produced by the filter.',
        params: [{ name: 'filter', description: 'Filter to repeat' }],
      },
      {
        id: 'inputs',
        name: 'inputs',
        description: 'Outputs all remaining inputs from the input stream one by one.',
        params: [],
      },
      {
        id: 'path',
        name: 'path',
        description: 'Outputs array representations of the given path expression.',
        params: [{ name: 'path_expression', description: 'Path expression' }],
      },
      {
        id: 'paths',
        name: 'paths',
        description: 'Outputs the paths to all elements in the input structure.',
        params: [],
      },
      {
        id: 'leaf_paths',
        name: 'leaf_paths',
        description: 'Outputs the paths to all leaf elements (scalars) in the input.',
        params: [],
      },
      {
        id: 'limit',
        name: 'limit',
        description: 'Outputs at most n values from the provided filter.',
        params: [
          { name: 'n', description: 'Maximum count' },
          { name: 'filter', description: 'Filter to limit' },
        ],
      },
      {
        id: 'first',
        name: 'first',
        description:
          'Outputs the first value produced by the filter — or, called bare, the first element of the input.',
        params: [
          {
            name: 'filter',
            description: 'Filter to evaluate (omit for the first element of the input)',
            optional: true,
          },
        ],
      },
      {
        id: 'last',
        name: 'last',
        description:
          'Outputs the last value produced by the filter — or, called bare, the last element of the input.',
        params: [
          {
            name: 'filter',
            description: 'Filter to evaluate (omit for the last element of the input)',
            optional: true,
          },
        ],
      },
      {
        id: 'nth',
        name: 'nth',
        description: 'Outputs the n-th value produced by the filter.',
        params: [
          { name: 'n', description: 'Index' },
          { name: 'filter', description: 'Filter to evaluate' },
        ],
      },
      {
        id: 'isempty',
        name: 'isempty',
        description: 'Returns true if the filter produces no output, false otherwise.',
        params: [{ name: 'filter', description: 'Filter to check' }],
      },
      {
        id: 'all',
        name: 'all',
        description:
          'Returns true if the filter evaluates to true for all elements in the input array/stream.',
        params: [{ name: 'filter', description: 'Filter to evaluate' }],
      },
      {
        id: 'any',
        name: 'any',
        description:
          'Returns true if the filter evaluates to true for any element in the input array/stream.',
        params: [{ name: 'filter', description: 'Filter to evaluate' }],
      },
      {
        id: 'transpose',
        name: 'transpose',
        description: 'Transposes an array of arrays (swaps rows and columns).',
        params: [],
      },
      {
        id: 'combinations_0',
        name: 'combinations',
        description: 'Outputs all combinations of elements from the input arrays.',
        params: [],
      },
      {
        id: 'combinations_1',
        name: 'combinations',
        description: 'Outputs all combinations of length n from the input array.',
        params: [{ name: 'n', description: 'Combination length' }],
      },
      {
        id: 'group_by',
        name: 'group_by',
        description: 'Groups the elements of the input array by the value of the path expression.',
        params: [{ name: 'path_expression', description: 'Path to group by' }],
      },
      {
        id: 'sort',
        name: 'sort',
        description: 'Sorts the elements of the input array.',
        params: [],
      },
      {
        id: 'sort_by',
        name: 'sort_by',
        description: 'Sorts the elements of the input array by the given path.',
        params: [{ name: 'path_expression', description: 'Path to sort by' }],
      },
      {
        id: 'unique',
        name: 'unique',
        description: 'Removes duplicates from the input array.',
        params: [],
      },
      {
        id: 'unique_by',
        name: 'unique_by',
        description: 'Removes duplicates from the input array based on the given path.',
        params: [{ name: 'path_expression', description: 'Path for uniqueness' }],
      },
      {
        id: 'min_by',
        name: 'min_by',
        description: 'Returns the element with the minimum value at the given path.',
        params: [{ name: 'path_expression', description: 'Path to compare' }],
      },
      {
        id: 'max_by',
        name: 'max_by',
        description: 'Returns the element with the maximum value at the given path.',
        params: [{ name: 'path_expression', description: 'Path to compare' }],
      },
      // Transformation functions
      {
        id: 'length',
        name: 'length',
        description: 'Returns the length of a string, array, or object.',
        params: [],
      },
      {
        id: 'utf8bytelength',
        name: 'utf8bytelength',
        description: 'Returns the number of bytes used to encode a string in UTF-8.',
        params: [],
      },
      {
        id: 'keys',
        name: 'keys',
        description: "Returns an array of the object's keys (sorted).",
        params: [],
      },
      {
        id: 'keys_unsorted',
        name: 'keys_unsorted',
        description: "Returns an array of the object's keys (original order).",
        params: [],
      },
      {
        id: 'has',
        name: 'has',
        description:
          'Returns true if the object has the given key or the array has the given index.',
        params: [{ name: 'key', description: 'Key or index to check' }],
      },
      {
        id: 'in',
        name: 'in',
        description: 'Returns true if the input key is in the given object.',
        params: [{ name: 'object', description: 'Object to check in' }],
      },
      {
        id: 'del',
        name: 'del',
        description: 'Removes the element at the specified path from the object/array.',
        params: [{ name: 'path_expression', description: 'Path to delete' }],
      },
      {
        id: 'tostring',
        name: 'tostring',
        description: 'Converts the input value to a JSON string.',
        params: [],
      },
      {
        id: 'tonumber',
        name: 'tonumber',
        description: 'Converts the input string to a number.',
        params: [],
      },
      {
        id: 'fromjson',
        name: 'fromjson',
        description: 'Parses a JSON string and returns the structure.',
        params: [],
      },
      {
        id: 'tojson',
        name: 'tojson',
        description: 'Dumps the input structure to a JSON string.',
        params: [],
      },
      {
        id: 'type',
        name: 'type',
        description: "Returns the type of the input (e.g., 'string', 'number', 'array').",
        params: [],
      },
      {
        id: 'error',
        name: 'error',
        description: 'Aborts processing and outputs an error message.',
        params: [{ name: 'message', description: 'Error message' }],
      },
      { id: 'halt', name: 'halt', description: 'Stops the jq program.', params: [] },
      {
        id: 'add',
        name: 'add',
        description:
          'Adds all elements of an array (sum numbers, concatenate strings/arrays, merge objects).',
        params: [],
      },
      {
        id: 'split',
        name: 'split',
        description: 'Splits a string on the separator.',
        params: [{ name: 'separator', description: 'Separator string' }],
      },
      {
        id: 'join',
        name: 'join',
        description: 'Joins an array of strings with the separator.',
        params: [{ name: 'separator', description: 'Separator string' }],
      },
      {
        id: 'test',
        name: 'test',
        description: 'Tests if the input string matches the regex.',
        params: [{ name: 'regex', description: 'Regex pattern' }],
      },
      {
        id: 'match',
        name: 'match',
        description: 'Returns match object(s) for the regex in the input string.',
        params: [{ name: 'regex', description: 'Regex pattern' }],
      },
      {
        id: 'sub',
        name: 'sub',
        description: 'Substitutes the first match of regex with replacement.',
        params: [
          { name: 'regex', description: 'Regex pattern' },
          { name: 'replacement', description: 'Replacement string' },
        ],
      },
      {
        id: 'gsub',
        name: 'gsub',
        description: 'Substitutes all matches of regex with replacement.',
        params: [
          { name: 'regex', description: 'Regex pattern' },
          { name: 'replacement', description: 'Replacement string' },
        ],
      },
      {
        id: 'startswith',
        name: 'startswith',
        description: 'Returns true if input starts with the string.',
        params: [{ name: 'string', description: 'String to check' }],
      },
      {
        id: 'endswith',
        name: 'endswith',
        description: 'Returns true if input ends with the string.',
        params: [{ name: 'string', description: 'String to check' }],
      },
      {
        id: 'contains',
        name: 'contains',
        description: 'Returns true if the input contains the value.',
        params: [{ name: 'value', description: 'Value to check' }],
      },
      {
        id: 'ascii_downcase',
        name: 'ascii_downcase',
        description: 'Converts string to lower case.',
        params: [],
      },
      {
        id: 'ascii_upcase',
        name: 'ascii_upcase',
        description: 'Converts string to upper case.',
        params: [],
      },
      { id: 'now', name: 'now', description: 'Returns the current time since epoch.', params: [] },
      {
        id: 'strftime',
        name: 'strftime',
        description: 'Formats a timestamp string.',
        params: [{ name: 'format', description: 'Format string' }],
      },
      {
        id: 'strptime',
        name: 'strptime',
        description: 'Parses a time string.',
        params: [{ name: 'format', description: 'Format string' }],
      },
      {
        id: 'fromdate',
        name: 'fromdate',
        description: 'Parses an ISO 8601 date string to a timestamp.',
        params: [],
      },
      {
        id: 'todate',
        name: 'todate',
        description: 'Formats a timestamp as an ISO 8601 string.',
        params: [],
      },
      { id: 'floor', name: 'floor', description: 'Returns the floor of the number.', params: [] },
      {
        id: 'sqrt',
        name: 'sqrt',
        description: 'Returns the square root of the number.',
        params: [],
      },
      {
        id: 'pow',
        name: 'pow',
        description: 'Returns base raised to the power of exponent.',
        params: [
          { name: 'base', description: 'Base number' },
          { name: 'exponent', description: 'Exponent' },
        ],
      },
      {
        id: 'min',
        name: 'min',
        description: 'Returns the minimum element in an array.',
        params: [],
      },
      {
        id: 'max',
        name: 'max',
        description: 'Returns the maximum element in an array.',
        params: [],
      },
      {
        id: 'debug',
        name: 'debug',
        description: 'Prints the input value to stderr for debugging, then passes it through.',
        params: [],
      },
      { id: 'stderr', name: 'stderr', description: 'Prints the input to stderr.', params: [] },
    ],
  },
];

/** Get all built-in function names (deduplicated) for conflict detection */
export const getBuiltInFunctionNames = (): string[] => {
  const names = new Set<string>();
  for (const category of functionCategories) {
    for (const func of category.functions) {
      names.add(func.name);
    }
  }
  return Array.from(names);
};

/** Find a specific function def by its unique id */
export const getFunctionDefById = (id: string): FunctionDef | null => {
  for (const category of functionCategories) {
    const fn = category.functions.find((f) => f.id === id);
    if (fn) return fn;
  }
  return null;
};

/**
 * Resolves the {@link FunctionDef} a call refers to, tolerating the converter
 * storing the function NAME (e.g. `range`) rather than an arity-suffixed id
 * (`range_2`). A multi-arity builtin registers one def per overload
 * (`range_1` / `range_2` / `range_3`), so matching `f.id` against the stored
 * name resolves nothing and the call renders no param ports at all.
 *
 * Resolution order:
 *   1. exact id — custom defs (id === name) and single-arity builtins;
 *   2. by NAME disambiguated by ARITY (the count of connected positional args):
 *      the overload whose param count equals the arity, else the HIGHEST-arity
 *      overload so a fresh, unconnected call still surfaces ports to wire.
 *
 * @param options - The functions selectable for the call's type.
 * @param selected - The stored `selectedFunction` (an id or a bare name).
 * @param arity - The number of connected positional args.
 */
export const resolveFunctionDef = (
  options: FunctionDef[],
  selected: string | undefined,
  arity: number,
): FunctionDef | null => {
  if (!selected) return null;
  const byId = options.find((f) => f.id === selected);
  if (byId) return byId;
  const byName = options.filter((f) => f.name === selected);
  if (byName.length === 0) return null;
  if (byName.length === 1) return byName[0] ?? null;
  const exact = byName.find((f) => f.params.length === arity);
  if (exact) return exact;
  return byName.reduce((best, f) => (f.params.length > best.params.length ? f : best));
};

/**
 * The params a resolved def should render PORTS for, given the call's ARITY (the
 * count of connected positional args). Required params always show so an unwired
 * call still offers the slots it needs; a trailing OPTIONAL param shows only once
 * the arity reaches it — so a bare `first` (arity 0, its one param optional)
 * renders zero ports, while `first(x)` renders one.
 */
export const visibleParams = (def: FunctionDef | null, arity: number): FunctionParam[] => {
  if (!def) return [];
  const required = def.params.filter((p) => !p.optional).length;
  const count = Math.min(def.params.length, Math.max(required, arity));
  return def.params.slice(0, count);
};

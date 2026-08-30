export interface OperatorInfo {
  symbol: string;
  description: string;
}

export interface OperatorCategory {
  category: string;
  description: string;
  operators: OperatorInfo[];
}

export const OPERATOR_CATALOG: OperatorCategory[] = [
  {
    category: 'Arithmetic & String',
    description: 'Math, string manipulation, and collection merging.',
    operators: [
      { symbol: '+', description: 'Addition, concatenation, or object merging.' },
      { symbol: '-', description: 'Subtraction or array difference.' },
      { symbol: '*', description: 'Multiplication or string repetition.' },
      { symbol: '/', description: 'Division or string splitting.' },
      { symbol: '%', description: 'Modulo (remainder).' },
    ],
  },
  {
    category: 'Comparison & Logic',
    description: 'Comparing values and boolean logic.',
    operators: [
      { symbol: '==', description: 'Equality check.' },
      { symbol: '!=', description: 'Inequality check.' },
      { symbol: '<', description: 'Less than.' },
      { symbol: '<=', description: 'Less than or equal to.' },
      { symbol: '>', description: 'Greater than.' },
      { symbol: '>=', description: 'Greater than or equal to.' },
      { symbol: 'and', description: 'Logical AND.' },
      { symbol: 'or', description: 'Logical OR.' },
      { symbol: 'not', description: 'Logical NOT (unary).' },
    ],
  },
  {
    category: 'Flow & Filtering',
    description: 'Control how data moves and handles errors.',
    operators: [
      { symbol: '//', description: 'Alternative (default value if null/false).' },
      { symbol: '?', description: 'Error suppression.' },
    ],
  },
];

export const UNARY_OPERATORS = new Set(['not', '?']);

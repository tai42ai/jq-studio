/**
 * @fileoverview Unit tests for the pipe-chain AST helpers.
 */
import { describe, it, expect } from 'vitest';
import { flattenPipeStages, isUnrepresentableOperand } from './pipe-utils';
import { type ASTNode } from './types';

const path = (value: string): ASTNode => ({ type: 'Path', value });
const identity = (): ASTNode => ({ type: 'Identity', value: '.' });
const op = (operator: string, left: ASTNode, right: ASTNode): ASTNode => ({
  type: 'Operator',
  operator,
  left,
  right,
});
const pipe = (left: ASTNode, right: ASTNode): ASTNode => ({ type: 'Pipe', left, right });

describe('flattenPipeStages', () => {
  it('returns a non-pipe node as a single stage', () => {
    expect(flattenPipeStages(path('.a'))).toEqual([path('.a')]);
  });

  it('flattens a left-nested pipe into left-to-right stages', () => {
    // `(.a | .b) | .c` parses to Pipe(Pipe(.a, .b), .c).
    const ast = pipe(pipe(path('.a'), path('.b')), path('.c'));
    expect(flattenPipeStages(ast)).toEqual([path('.a'), path('.b'), path('.c')]);
  });
});

describe('isUnrepresentableOperand', () => {
  it('accepts a single-term operand', () => {
    expect(isUnrepresentableOperand(path('.a'))).toBe(false);
  });

  it('accepts a leading-identity pipe (reduces to one real stage)', () => {
    expect(isUnrepresentableOperand(pipe(identity(), path('.a')))).toBe(false);
  });

  it('accepts a multi-stage pipe of only simple chainable terms', () => {
    // `.a | last | .b` — a Path/FunctionCall/Path chain the serializer re-inlines.
    const ast = pipe(
      path('.a'),
      pipe({ type: 'FunctionCall', name: 'last', args: [] }, path('.b')),
    );
    expect(isUnrepresentableOperand(ast)).toBe(false);
  });

  it('rejects a multi-stage pipe with a non-chainable (operator) stage', () => {
    // `(.a // {}) | .b` — the operator stage confuses the operand chain walk.
    const ast = pipe(op('//', path('.a'), { type: 'Object', fields: [] }), path('.b'));
    expect(isUnrepresentableOperand(ast)).toBe(true);
  });
});

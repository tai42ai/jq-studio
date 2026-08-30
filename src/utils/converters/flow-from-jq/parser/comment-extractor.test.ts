import { describe, it, expect } from 'vitest';
import { splitChainComments } from './comment-extractor';

describe('splitChainComments', () => {
  it('should pass through a segment with no comments', () => {
    const result = splitChainComments('map(.x)');
    expect(result).toEqual({ leading: null, core: 'map(.x)', trailing: null });
  });

  it('should split a trailing inline comment', () => {
    const result = splitChainComments('. # identity');
    expect(result).toEqual({ leading: null, core: '.', trailing: 'identity' });
  });

  it('should split a leading standalone comment', () => {
    const result = splitChainComments('# header\n.field');
    expect(result).toEqual({ leading: 'header', core: '.field', trailing: null });
  });

  it('should keep a comment inside the expression in the core', () => {
    const segment = 'if .c then\n  .a # note\nelse\n  "fallback"\nend';
    const result = splitChainComments(segment);
    expect(result).toEqual({ leading: null, core: segment, trailing: null });
  });

  it('should keep a comment inside a call argument in the core', () => {
    const result = splitChainComments('map(.x # note\n)');
    expect(result).toEqual({ leading: null, core: 'map(.x # note\n)', trailing: null });
  });

  it('should NOT read # inside string literals as a comment', () => {
    const result = splitChainComments('"hello # world"');
    expect(result).toEqual({ leading: null, core: '"hello # world"', trailing: null });
  });

  it('should handle # after a string literal on the same line', () => {
    const result = splitChainComments('"value" # the value');
    expect(result).toEqual({ leading: null, core: '"value"', trailing: 'the value' });
  });

  it('should handle escaped quotes inside strings', () => {
    const result = splitChainComments('"say \\"hello\\"" # greeting');
    expect(result).toEqual({ leading: null, core: '"say \\"hello\\""', trailing: 'greeting' });
  });

  it('should drop a comment with no text', () => {
    const result = splitChainComments('. #');
    expect(result).toEqual({ leading: null, core: '.', trailing: null });
  });

  it('should report a segment of comments only as leading', () => {
    const result = splitChainComments('# just a comment');
    expect(result).toEqual({ leading: 'just a comment', core: '', trailing: null });
  });

  it('should preserve comment text with special characters', () => {
    const result = splitChainComments('map(.x) # TODO: fix this!');
    expect(result).toEqual({ leading: null, core: 'map(.x)', trailing: 'TODO: fix this!' });
  });

  it('should treat only the first # of a line as the comment start', () => {
    const result = splitChainComments('. # first # second');
    expect(result).toEqual({ leading: null, core: '.', trailing: 'first # second' });
  });

  it('should trim whitespace around comment text', () => {
    const result = splitChainComments('.   #   spaced   ');
    expect(result).toEqual({ leading: null, core: '.', trailing: 'spaced' });
  });

  it('should merge consecutive leading comment lines into one text', () => {
    const result = splitChainComments('# line1\n# line2\n.field');
    expect(result).toEqual({ leading: 'line1\nline2', core: '.field', trailing: null });
  });

  it('should merge leading comment lines separated by a blank line', () => {
    const result = splitChainComments('# line1\n\n# line2\n.field');
    expect(result).toEqual({ leading: 'line1\nline2', core: '.field', trailing: null });
  });

  it('should merge an inline comment with the standalone comments after it', () => {
    const result = splitChainComments('.field # inline\n# standalone');
    expect(result).toEqual({ leading: null, core: '.field', trailing: 'inline\nstandalone' });
  });

  it('should split comments on both sides of the expression', () => {
    const result = splitChainComments('# before\n.field # after');
    expect(result).toEqual({ leading: 'before', core: '.field', trailing: 'after' });
  });

  it('should report an empty segment as empty', () => {
    expect(splitChainComments('   ')).toEqual({ leading: null, core: '', trailing: null });
  });
});

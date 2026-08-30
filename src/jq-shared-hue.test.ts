/**
 * @fileoverview The shared-hue badge rule: kinds that share their chrome colour
 * with another kind wear a disambiguating badge; kinds with a unique hue do not.
 * Derived from the registry, so this pins the colour assignments the cards rely
 * on to stay tellable apart.
 */
import { describe, expect, it } from 'vitest';
import { JQNodeType } from './enums';
import { JQ_KIND_REGISTRY, jqKindHasSharedHue } from './jq-kind-registry';

describe('jqKindHasSharedHue', () => {
  it('badges the primary-hued kinds (Input / Call / Define share primary)', () => {
    expect(jqKindHasSharedHue(JQNodeType.Start)).toBe(true);
    expect(jqKindHasSharedHue(JQNodeType.FunctionCall)).toBe(true);
    expect(jqKindHasSharedHue(JQNodeType.FunctionDecl)).toBe(true);
  });

  it('badges the muted-hued kinds (Value / Operator / Comment share muted)', () => {
    expect(jqKindHasSharedHue(JQNodeType.Value)).toBe(true);
    expect(jqKindHasSharedHue(JQNodeType.Operator)).toBe(true);
    expect(jqKindHasSharedHue(JQNodeType.Comment)).toBe(true);
  });

  it('does not badge the unique-hued kinds (Condition warning, Try/Catch danger)', () => {
    expect(jqKindHasSharedHue(JQNodeType.Condition)).toBe(false);
    expect(jqKindHasSharedHue(JQNodeType.TryCatch)).toBe(false);
  });

  it('the registry carries the Def badge for Define Function', () => {
    expect(JQ_KIND_REGISTRY[JQNodeType.FunctionDecl].badge).toBe('Def');
  });
});

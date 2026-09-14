/**
 * @fileoverview Tests for the jq connection readers: which node types a drag
 * from a handle may reach, and whether a concrete source→target is allowed.
 */

import { describe, it, expect } from 'vitest';
import { getValidJQNodeTypesForConnection, validateJQConnection } from './connection-validator';
import { JQNodeType, JQHandleIdPrefix } from '../enums';

describe('Connection Validation: FunctionCall as item/field/param/root target', () => {
  describe('getValidJQNodeTypesForConnection', () => {
    it('should allow FunctionCall as target of item: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Value,
        'source',
        `${JQHandleIdPrefix.Item}:0`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
    });

    it('should allow FunctionCall as target of field: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Value,
        'source',
        `${JQHandleIdPrefix.Field}:0`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
    });

    it('should allow FunctionCall as target of root: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.FunctionCall,
        'source',
        `${JQHandleIdPrefix.Root}:fc1`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
    });

    it('should allow FunctionCall as target of param: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.FunctionCall,
        'source',
        `${JQHandleIdPrefix.Param}:0`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
      expect(types).toContain(JQNodeType.Condition);
    });
  });

  describe('validateJQConnection', () => {
    it('should accept FunctionCall as target of item: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Value,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Item}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of field: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Value,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Field}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of root: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.FunctionCall,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Root}:fc1`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of param: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.FunctionCall,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Param}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should still reject Operator as target of item: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Value,
          JQNodeType.Operator,
          `${JQHandleIdPrefix.Item}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(false);
    });
  });
});

describe('Connection Validation: operator operand handles', () => {
  // The jq generator reads an operand's operator nesting off that operand's own
  // operator-handle edges, so an edge into an operator drawn from any other
  // handle leaves the graph unconvertible — and unsaveable.
  it('should accept an operand reaching an operator over its operator handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.OperatorLeft}:v1`,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(true);
    expect(
      validateJQConnection(
        JQNodeType.FunctionCall,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.OperatorRight}:fc1`,
        JQHandleIdPrefix.OperatorRight,
      ),
    ).toBe(true);
  });

  it('should refuse an operand reaching an operator over its bottom handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Operator,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(false);
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Operator,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.OperatorRight,
      ),
    ).toBe(false);
  });

  it('should refuse an operand reaching an operator over a param handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.FunctionCall,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.Param}:0`,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(false);
  });

  it('should refuse a node type that is no operand on an operator target handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Condition,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.OperatorLeft}:c1`,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(false);
  });
});

describe('Connection Validation: TryCatch', () => {
  describe('getValidJQNodeTypesForConnection', () => {
    it('should allow Value and FunctionCall as targets of try handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Try,
      );
      expect(types).toContain(JQNodeType.Value);
      expect(types).toContain(JQNodeType.FunctionCall);
    });

    it('should allow Value and FunctionCall as targets of catch handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Catch,
      );
      expect(types).toContain(JQNodeType.Value);
      expect(types).toContain(JQNodeType.FunctionCall);
    });

    it('should allow Condition and TryCatch as targets of try handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Try,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });

    it('should allow Condition and TryCatch as targets of catch handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Catch,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });
  });

  describe('validateJQConnection', () => {
    it('should accept Value as target of try handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.Value,
          JQHandleIdPrefix.Try,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of catch handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.FunctionCall,
          JQHandleIdPrefix.Catch,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept Condition as target of try handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.Condition,
          JQHandleIdPrefix.Try,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target of catch handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.TryCatch,
          JQHandleIdPrefix.Catch,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target from Start flow handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Start,
          JQNodeType.TryCatch,
          JQHandleIdPrefix.Flow,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });
  });
});

describe('Connection Validation: Condition side handles', () => {
  describe('getValidJQNodeTypesForConnection', () => {
    it('should allow Condition and TryCatch as targets of if handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Condition,
        'source',
        `${JQHandleIdPrefix.If}:0`,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });

    it('should allow Condition and TryCatch as targets of then handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Condition,
        'source',
        `${JQHandleIdPrefix.Then}:0`,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });

    it('should allow Condition and TryCatch as targets of else handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Condition,
        'source',
        JQHandleIdPrefix.Else,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });
  });

  describe('validateJQConnection', () => {
    it('should accept Condition as target of if handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.Condition,
          `${JQHandleIdPrefix.If}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target of then handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.TryCatch,
          `${JQHandleIdPrefix.Then}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept Condition as target of else handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.Condition,
          JQHandleIdPrefix.Else,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target of else handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.TryCatch,
          JQHandleIdPrefix.Else,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });
  });
});

describe('Comment Node Connection Validation', () => {
  it('should allow bottom→top connection from Value to Comment', () => {
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Comment,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(true);
  });

  it('should allow bottom→top connection from Comment to pipeline node', () => {
    expect(
      validateJQConnection(
        JQNodeType.Comment,
        JQNodeType.Value,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(true);
  });

  it('should reject Comment→Comment connections', () => {
    expect(
      validateJQConnection(
        JQNodeType.Comment,
        JQNodeType.Comment,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(false);
  });

  it('should allow Comment as target from Start flow handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Start,
        JQNodeType.Comment,
        JQHandleIdPrefix.Flow,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(true);
  });

  it('should include Comment in valid types for bottom source handle', () => {
    const validTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Value,
      'source',
      JQHandleIdPrefix.Bottom,
    );
    expect(validTypes).toContain(JQNodeType.Comment);
  });

  it('should include pipeline nodes as valid types for Comment bottom handle', () => {
    const validTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Comment,
      'source',
      JQHandleIdPrefix.Bottom,
    );
    expect(validTypes).toContain(JQNodeType.Value);
    expect(validTypes).toContain(JQNodeType.FunctionCall);
    // Comment→Comment is NOT allowed
    expect(validTypes).not.toContain(JQNodeType.Comment);
  });

  it('should include Comment in valid flow handle targets', () => {
    const validTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Start,
      'source',
      JQHandleIdPrefix.Flow,
    );
    expect(validTypes).toContain(JQNodeType.Comment);
  });

  it('should NOT include Comment as valid target for param/item/field handles', () => {
    const paramTypes = getValidJQNodeTypesForConnection(
      JQNodeType.FunctionCall,
      'source',
      `${JQHandleIdPrefix.Param}:0`,
    );
    expect(paramTypes).not.toContain(JQNodeType.Comment);

    const itemTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Value,
      'source',
      `${JQHandleIdPrefix.Item}:0`,
    );
    expect(itemTypes).not.toContain(JQNodeType.Comment);

    const fieldTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Value,
      'source',
      `${JQHandleIdPrefix.Field}:0`,
    );
    expect(fieldTypes).not.toContain(JQNodeType.Comment);
  });
});

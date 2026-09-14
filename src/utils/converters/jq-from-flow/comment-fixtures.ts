/**
 * @fileoverview Shared node builders for the inline-comment jq-from-flow tests.
 */

import { createPathNode, createPathSegment } from '../test-helpers';

/** `.a` as an unnamed Value node, so it contributes no `as $var` binding. */
export const fieldA = (id: string) =>
  createPathNode(
    id,
    [createPathSegment(`${id}_s1`, 'root', ''), createPathSegment(`${id}_s2`, 'field', 'a')],
    { name: '' },
  );

import type { Node, NodeProps } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { memo, useCallback } from 'react';

import { JQNodeType } from '../enums';
import { Textarea } from '../primitives';
import { useSnapshot } from '../SnapshotContext';
import { useTransformerReadOnly } from '../TransformerContext';
import type { JQCommentData, JQNodeData } from '../types';
import { TransformerNode } from './TransformerNode';

type CommentNodeProps = NodeProps<Node<JQCommentData>>;

export const CommentNode = memo(({ id, data, selected }: CommentNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQNodeData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();
  const collapsed = !selected;

  const onTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text: e.target.value } } : n)),
      );
    },
    [id, setNodes],
  );

  const onTextFocus = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const firstLine = data.text.split('\n')[0] ?? '';
  const summaryText = firstLine
    ? `# ${firstLine.slice(0, 30)}${firstLine.length > 30 ? '...' : ''}`
    : '# ...';

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.Comment}
      title="Comment"
      icon={<MessageSquare className="jqs-jq-icon" />}
      selected={selected}
      collapsed={collapsed}
      summary={summaryText}
    >
      {!collapsed && (
        <Textarea
          value={data.text}
          onChange={onTextChange}
          onFocus={onTextFocus}
          readOnly={readOnly}
          placeholder="Add a comment..."
          rows={2}
          style={{ minHeight: '60px', resize: 'vertical' }}
        />
      )}
    </TransformerNode>
  );
});

CommentNode.displayName = 'CommentNode';

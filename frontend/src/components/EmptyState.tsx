import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export default function EmptyState({ description, actionText, onAction, icon }: EmptyStateProps) {
  return (
    <Empty
      image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
      style={{ padding: '48px 0' }}
    >
      {actionText && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </Empty>
  );
}

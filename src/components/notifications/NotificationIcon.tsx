/**
 * NotificationIcon - Type-based notification emoji
 * 
 * Displays an appropriate emoji based on notification type.
 */

import React from 'react';
import { getNotificationIcon } from '@/types/notificationTypes';

interface NotificationIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
} as const;

const emojiMap: Record<string, string> = {
  thread: '🔗',
  comment: '💬',
  patch: '🫶',
  tag: '🏷️',
  heart: '❤️',
  collab: '🤝',
  access: '🔒',
  approved: '✅',
  rejected: '❌',
  revoked: '🚫',
  mail: '📩',
  celebrate: '🎉',
  contribution: '🤲',
  security: '🛡️',
  logout: '🚪',
  order: '🛍️',
  order_status: '📦',
  upload: '📤',
  delete: '🗑️',
  fit: '📏',
  bell: '🔔',
};

export const NotificationIcon = React.memo<NotificationIconProps>(
  ({ type, size = 'md', className = '' }) => {
    const iconKey = getNotificationIcon(type);
    const emoji = emojiMap[iconKey] || '🔔';

    return (
      <span className={`${sizeClass[size]} leading-none ${className}`} aria-hidden="true">
        {emoji}
      </span>
    );
  }
);

NotificationIcon.displayName = 'NotificationIcon';

/**
 * NotificationIcon - Type-based notification icons
 * 
 * Displays an appropriate icon/emoji based on notification type.
 */

import React from 'react';
import { getNotificationIcon } from '@/types/notificationTypes';

interface NotificationIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export const NotificationIcon = React.memo<NotificationIconProps>(
  ({ type, size = 'md', className = '' }) => {
    const icon = getNotificationIcon(type);
    const sizeClass = sizeClasses[size];

    return (
      <span 
        className={`${sizeClass} ${className}`}
        role="img"
        aria-hidden="true"
      >
        {icon}
      </span>
    );
  }
);

NotificationIcon.displayName = 'NotificationIcon';

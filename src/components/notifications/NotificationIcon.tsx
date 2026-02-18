/**
 * NotificationIcon - Type-based notification icons
 * 
 * Displays an appropriate icon/emoji based on notification type.
 */

import React from 'react';
import {
  Bell,
  MessageCircle,
  Link2,
  UserPlus,
  Share2,
  Lock,
  CheckCircle,
  XCircle,
  Mail,
  Sparkles,
  Handshake,
  ShieldCheck,
  LogOut,
  ShoppingCart,
  Package,
  Upload,
  Trash2,
  Ruler,
  Tag,
} from 'lucide-react';
import { getNotificationIcon } from '@/types/notificationTypes';

interface NotificationIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizePx = {
  sm: 14,
  md: 16,
  lg: 18,
} as const;

const iconMap: Record<string, React.ElementType> = {
  thread: Link2,
  comment: MessageCircle,
  patch: UserPlus,
  tag: Tag,
  collab: Share2,
  access: Lock,
  approved: CheckCircle,
  rejected: XCircle,
  revoked: Lock,
  mail: Mail,
  celebrate: Sparkles,
  contribution: Handshake,
  security: ShieldCheck,
  logout: LogOut,
  order: ShoppingCart,
  order_status: Package,
  upload: Upload,
  delete: Trash2,
  fit: Ruler,
  bell: Bell,
};

export const NotificationIcon = React.memo<NotificationIconProps>(
  ({ type, size = 'md', className = '' }) => {
    const iconKey = getNotificationIcon(type);
    const Icon = iconMap[iconKey] || Bell;

    return (
      <Icon className={className} size={sizePx[size]} aria-hidden="true" />
    );
  }
);

NotificationIcon.displayName = 'NotificationIcon';

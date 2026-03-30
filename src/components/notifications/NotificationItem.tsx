/**
 * NotificationItem - Multi-target click notification component
 * 
 * Implements the Multi-Target Notification Pattern with:
 * - Avatar click → Actor profile
 * - Username click → Actor profile
 * - Body click → Target content
 * - Event isolation via stopPropagation
 * - Accessibility features (keyboard nav, ARIA)
 * - Telemetry integration
 */

import React, { useCallback } from 'react';
import { NotificationAvatar } from './NotificationAvatar';
import { NotificationIcon } from './NotificationIcon';
import { getActionText, getAriaAction } from '@/types/notificationTypes';
import { hasValidActor, getActorDisplayName } from '@/utils/notificationAdapter';
import type { NormalizedNotification } from '@/utils/notificationAdapter';
import { trackOnce, createTelemetryEvent } from '@/utils/notificationTelemetry';
import './NotificationItem.css';

// Utility function for relative time
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface NotificationItemProps {
  notification: NormalizedNotification;
  onAvatarClick: (actorId: string) => void;
  onUsernameClick: (actorId: string) => void;
  onBodyClick: (notification: NormalizedNotification) => void;
  onMarkRead: (id: string) => void;
}

export const NotificationItem = React.memo<NotificationItemProps>(
  ({ notification, onAvatarClick, onUsernameClick, onBodyClick, onMarkRead }) => {
    const { id, type, isRead, actor, target, message } = notification;
    const displayName = getActorDisplayName(notification);
    const actionText = getActionText(type);
    const ariaAction = getAriaAction(type);
    const hasActor = hasValidActor(notification);

    // Memoized mark-read handler
    const handleMarkRead = useCallback(() => {
      if (!isRead) {
        onMarkRead(id);
      }
    }, [id, isRead, onMarkRead]);

    // Avatar click handler with event isolation
    const handleAvatarClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      handleMarkRead();
      
      // Track telemetry
      trackOnce(`${id}-avatar`, createTelemetryEvent(notification, 'avatar_click'));
      
      if (hasActor && actor?.id) {
        onAvatarClick(actor.id);
      }
    }, [id, actor?.id, hasActor, handleMarkRead, onAvatarClick, notification]);

    // Username click handler with event isolation
    const handleUsernameClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      handleMarkRead();
      
      trackOnce(`${id}-username`, createTelemetryEvent(notification, 'username_click'));
      
      if (hasActor && actor?.id) {
        onUsernameClick(actor.id);
      }
    }, [id, actor?.id, hasActor, handleMarkRead, onUsernameClick, notification]);

    // Body click handler (parent click)
    const handleBodyClick = useCallback(() => {
      handleMarkRead();
      
      trackOnce(`${id}-body`, createTelemetryEvent(notification, 'body_click'));
      
      onBodyClick(notification);
    }, [id, handleMarkRead, onBodyClick, notification]);

    // Keyboard handler for accessibility
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleMarkRead();
        
        trackOnce(`${id}-keyboard`, createTelemetryEvent(notification, 'keyboard_activate'));
        
        onBodyClick(notification);
      }
    }, [id, handleMarkRead, onBodyClick, notification]);

    // Construct full aria label
    const ariaLabel = `${isRead ? 'Read' : 'Unread'} notification from ${displayName}: ${message}. ${timeAgo(notification.createdAt)}`;

    return (
      <li
        className={`notification-item ${isRead ? 'read' : 'unread'}`}
        onClick={handleBodyClick}
        onKeyDown={handleKeyDown}
        role="listitem"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-current={!isRead ? 'true' : undefined}
        data-testid="notification-item"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Avatar Section */}
        <div
          className={`avatar-section ${hasActor ? 'clickable' : 'non-clickable'}`}
          onClick={hasActor ? handleAvatarClick : undefined}
          role={hasActor ? 'button' : 'img'}
          aria-label={hasActor ? `View profile of ${displayName}` : 'Threadly notification'}
          tabIndex={hasActor ? 0 : -1}
          data-testid="notification-avatar"
        >
          <NotificationAvatar 
            actor={actor} 
            isRead={isRead}
          />
        </div>

        {/* Content Section */}
        <div className="content-section" data-testid="notification-body">
          {/* Header with username and action */}
          <div className="notification-header">
            {hasActor ? (
              <span
                className="username"
                onClick={handleUsernameClick}
                role="link"
                aria-label={`View profile of ${displayName}`}
                tabIndex={0}
                data-testid="notification-username"
              >
                {displayName}
              </span>
            ) : (
              <span className="username system">{displayName}</span>
            )}
            {actionText && (
              <span className="action-text"> {actionText}</span>
            )}
            {target?.preview && (
              <span className="target-preview"> {target.preview}</span>
            )}
          </div>

          {/* Preview text if no action text */}
          {!actionText && message && (
            <p className="preview-text">{message}</p>
          )}

          {/* Timestamp */}
          <span className="timestamp" aria-hidden="true">
            {timeAgo(notification.createdAt)}
          </span>
          
          {/* Screen reader only full context */}
          <span className="sr-only">
            {message}. {isRead ? 'Read' : 'Unread'}. {ariaAction}
          </span>
        </div>

        {/* Type Icon */}
        <div className="icon-section">
          <NotificationIcon type={type} size="sm" />
        </div>
      </li>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these change
    return (
      prevProps.notification.id === nextProps.notification.id &&
      prevProps.notification.isRead === nextProps.notification.isRead
    );
  }
);

NotificationItem.displayName = 'NotificationItem';

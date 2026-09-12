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

// A `target.preview` is meant to be a short human snippet (e.g. a comment
// excerpt). Some system notifications reuse it to carry a route path — never
// show that raw path/URL to the user; it's used only for routing.
function isRouteyPreview(preview?: string | null): boolean {
  if (!preview) return false;
  return preview.startsWith('/') || /^https?:\/\//i.test(preview);
}

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
  /**
   * Renders the dismiss control. It lives inside the row rather than in the
   * caller's markup because the row IS the `<li>` — an outer wrapper would
   * nest one list item inside another.
   */
  onDelete?: (id: string) => void;
}

export const NotificationItem = React.memo<NotificationItemProps>(
  ({ notification, onAvatarClick, onUsernameClick, onBodyClick, onMarkRead, onDelete }) => {
    const { id, type, isRead, actor, target, message } = notification;
    const displayName = getActorDisplayName(notification);
    const actionText = getActionText(type);
    const ariaAction = getAriaAction(type);
    const hasActor = hasValidActor(notification);

    /*
      A system notification's `message` is a finished sentence written by the
      server ("You've successfully bagged X by Y. Check out soon…").

      The actor + action + preview template below is for notifications where a
      PERSON acted on your content — "@ada commented on Wrap Dress". Running a
      system row through it prepends the sender and appends the target preview
      to a sentence that already reads correctly, and then drops the sentence
      entirely (`message` only renders when there is no `actionText`). That is
      how a bag confirmation rendered as "WIEZ added to your bag Bag", and an
      unread-messages digest as "WIEZ you have unread order messages".

      `NotificationsDropdown` already prefers the server sentence when there is
      no actor, so this is what stops the two surfaces disagreeing about the
      same notification.
    */
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const isPlaceholderMessage =
      /^you have a (new )?notification$/i.test(trimmedMessage);
    const serverSentence =
      trimmedMessage && !isPlaceholderMessage ? trimmedMessage : '';
    const useServerSentence = !hasActor && Boolean(serverSentence);

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

    const handleDelete = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(id);
    }, [id, onDelete]);

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
    const ariaLabel = useServerSentence
      ? `${isRead ? 'Read' : 'Unread'} notification: ${serverSentence} ${timeAgo(notification.createdAt)}`
      : `${isRead ? 'Read' : 'Unread'} notification from ${displayName}: ${message}. ${timeAgo(notification.createdAt)}`;

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
          aria-label={hasActor ? `View profile of ${displayName}` : 'WIEZ notification'}
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
          {useServerSentence ? (
            /* The server wrote the whole sentence — render it as one. */
            <p className="notification-sentence">{serverSentence}</p>
          ) : (
            <>
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
                {target?.preview && !isRouteyPreview(target.preview) && (
                  <span className="target-preview"> {target.preview}</span>
                )}
              </div>

              {/* Preview text if no action text */}
              {!actionText && message && (
                <p className="preview-text">{message}</p>
              )}
            </>
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

        {onDelete ? (
          <button
            type="button"
            className="notification-dismiss"
            onClick={handleDelete}
            aria-label="Delete notification"
            data-testid="notification-delete"
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </li>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these change
    return (
      prevProps.notification.id === nextProps.notification.id &&
      prevProps.notification.isRead === nextProps.notification.isRead &&
      Boolean(prevProps.onDelete) === Boolean(nextProps.onDelete)
    );
  }
);

NotificationItem.displayName = 'NotificationItem';

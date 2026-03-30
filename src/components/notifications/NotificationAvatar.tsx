/**
 * NotificationAvatar - Avatar component for notifications
 * 
 * Displays the actor's profile image or initials with unread indicator.
 */

import React from 'react';
import MediaRenderer from '../media/MediaRenderer';

interface NotificationAvatarProps {
  actor: {
    id?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
  } | null;
  isRead: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-8 max-h-8 text-xs',
  md: 'max-w-9 max-h-9 text-sm',
  lg: 'max-w-11 max-h-11 text-base',
};

export const NotificationAvatar = React.memo<NotificationAvatarProps>(
  ({ actor, isRead, size = 'md' }) => {
    const sizeClass = sizeClasses[size];
    
    // Get display name for alt text and initials fallback
    const displayName = actor?.username 
      || [actor?.firstName, actor?.lastName].filter(Boolean).join(' ')
      || 'Threadly';
    
    // Get initials for avatar fallback
    const initials = actor?.username 
      ? actor.username.slice(0, 2).toUpperCase()
      : actor?.firstName && actor?.lastName
        ? `${actor.firstName.charAt(0)}${actor.lastName.charAt(0)}`.toUpperCase()
        : 'TH';

    return (
      <div className="relative shrink-0">
        {actor?.profileImage ? (
          <MediaRenderer
            kind="image"
            src={actor.profileImage}
            alt={displayName}
            maxHeightClassName={sizeClass.split(' ').find((c) => c.startsWith('max-h-')) || 'max-h-9'}
            maxWidthClassName={sizeClass.split(' ').find((c) => c.startsWith('max-w-')) || 'max-w-9'}
            className={`rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-transform duration-150`}
            mediaClassName="rounded-xl"
          />
        ) : (
          <div 
            className={`${sizeClass} rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800`}
            aria-label={displayName}
          >
            {initials}
          </div>
        )}
        
        {/* Unread indicator dot */}
        {!isRead && (
          <div 
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-white dark:border-gray-900"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);

NotificationAvatar.displayName = 'NotificationAvatar';

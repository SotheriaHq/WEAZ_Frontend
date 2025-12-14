/**
 * NotificationAvatar - Avatar component for notifications
 * 
 * Displays the actor's profile image or initials with unread indicator.
 */

import React from 'react';

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
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

export const NotificationAvatar = React.memo<NotificationAvatarProps>(
  ({ actor, isRead, size = 'md' }) => {
    const sizeClass = sizeClasses[size];
    
    // Get display name for alt text and initials fallback
    const displayName = actor?.username 
      || [actor?.firstName, actor?.lastName].filter(Boolean).join(' ')
      || 'System';
    
    // Get initials for avatar fallback
    const initials = actor?.username 
      ? actor.username.slice(0, 2).toUpperCase()
      : actor?.firstName && actor?.lastName
        ? `${actor.firstName.charAt(0)}${actor.lastName.charAt(0)}`.toUpperCase()
        : 'SY';

    return (
      <div className="relative shrink-0">
        {actor?.profileImage ? (
          <img 
            src={actor.profileImage} 
            alt={displayName}
            className={`${sizeClass} rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm transition-transform duration-150`}
            loading="lazy"
          />
        ) : (
          <div 
            className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800`}
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

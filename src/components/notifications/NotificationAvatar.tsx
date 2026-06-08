/**
 * NotificationAvatar - Avatar component for notifications
 * 
 * Displays the actor's profile image or initials with unread indicator.
 */

import React from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';

interface NotificationAvatarProps {
  actor: {
    id?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    profileImageId?: string | null;
    profileImageFile?: {
      id?: string | null;
      s3Url?: string | null;
      url?: string | null;
    } | null;
  } | null;
  isRead: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

export const NotificationAvatar = React.memo<NotificationAvatarProps>(
  ({ actor, isRead, size = 'md' }) => {
    const sizeClass = sizeClasses[size];
    
    // Get display name for alt text and initials fallback
    const displayName = actor?.username 
      || [actor?.firstName, actor?.lastName].filter(Boolean).join(' ')
      || 'WEAZ';
    const avatar = resolveProfileImageSource(actor);
    const initials = getAvatarFallback(displayName, actor?.username) || 'TH';

    return (
      <div className="relative shrink-0">
        <ImageWithFallback
          src={avatar.src}
          fileId={avatar.fileId}
          alt={displayName}
          fallbackName={initials}
          fit="cover"
          rounded="xl"
          className={`${sizeClass} object-cover`}
          containerClassName={`${sizeClass} rounded-xl border border-gray-200 shadow-sm transition-transform duration-150 dark:border-gray-700`}
        />
        
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

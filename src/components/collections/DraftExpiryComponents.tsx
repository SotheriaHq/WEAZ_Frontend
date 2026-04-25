import React from 'react';
import { Clock, AlertTriangle, Trash2, Edit3, ArrowRight } from 'lucide-react';

/**
 * Draft Expiry Warning Components (Item #5 Screens)
 * 
 * Shows warnings for drafts that are approaching expiration.
 * The backend sends notifications at 7 days and 1 day before expiry.
 * 
 * USAGE:
 * - DraftExpiryBanner: Show at top of draft edit page
 * - DraftExpiryListItem: Show in the drafts list view
 * - DraftExpiryNotification: Toast notification format
 */

interface DraftExpiryProps {
  draftId: string;
  draftTitle: string;
  expiresAt: Date;
  onEdit?: () => void;
  onDelete?: () => void;
}

const formatTimeRemaining = (expiresAt: Date): string => {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expired';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 1) return `${diffDays} days left`;
  if (diffDays === 1) return '1 day left';
  if (diffHours > 1) return `${diffHours} hours left`;
  if (diffHours === 1) return '1 hour left';
  return 'Less than 1 hour';
};

const getUrgencyLevel = (expiresAt: Date): 'critical' | 'warning' | 'notice' => {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours <= 24) return 'critical';
  if (diffHours <= 168) return 'warning'; // 7 days
  return 'notice';
};

/**
 * Banner component for draft edit page
 */
export const DraftExpiryBanner: React.FC<DraftExpiryProps> = ({
  draftTitle,
  expiresAt,
  onEdit,
}) => {
  const urgency = getUrgencyLevel(expiresAt);
  const timeLeft = formatTimeRemaining(expiresAt);
  
  const urgencyStyles = {
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800/40',
      icon: 'text-red-600 dark:text-red-400',
      text: 'text-red-800 dark:text-red-200',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800/40',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-800 dark:text-amber-200',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    notice: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800/40',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-800 dark:text-blue-200',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  };
  
  const styles = urgencyStyles[urgency];

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {urgency === 'critical' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${styles.text}`}>
            {urgency === 'critical' ? 'Draft Expiring Soon!' : 'Draft Expiration Notice'}
          </h3>
          <p className={`text-sm mt-1 ${styles.text} opacity-80`}>
            Your draft "{draftTitle}" will be automatically deleted in <strong>{timeLeft}</strong>.
            {urgency === 'critical' 
              ? ' Please publish or save your changes immediately.'
              : ' Consider publishing or completing your edits soon.'
            }
          </p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${styles.button}`}
          >
            <Edit3 className="w-4 h-4" />
            Continue Editing
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * List item component for drafts list view
 */
export const DraftExpiryListItem: React.FC<DraftExpiryProps & { mediaCount?: number }> = ({
  draftId,
  draftTitle,
  expiresAt,
  onEdit,
  onDelete,
  mediaCount,
}) => {
  const urgency = getUrgencyLevel(expiresAt);
  const timeLeft = formatTimeRemaining(expiresAt);
  
  const urgencyColors = {
    critical: 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10',
    notice: 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50',
  };
  
  const badgeColors = {
    critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    notice: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  };

  return (
    <div 
      className={`border rounded-xl p-4 transition-all hover:shadow-md ${urgencyColors[urgency]}`}
      data-draft-id={draftId}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {draftTitle || 'Untitled Draft'}
            </h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[urgency]}`}>
              {timeLeft}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-zinc-400">
            {mediaCount !== undefined && (
              <span>{mediaCount} {mediaCount === 1 ? 'item' : 'items'}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Expires {new Date(expiresAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="Delete draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Notification toast content
 */
export const DraftExpiryNotificationContent: React.FC<{
  draftTitle: string;
  expiresAt: Date;
  onAction?: () => void;
}> = ({ draftTitle, expiresAt, onAction }) => {
  const urgency = getUrgencyLevel(expiresAt);
  const timeLeft = formatTimeRemaining(expiresAt);
  
  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 p-1.5 rounded-lg ${
        urgency === 'critical' 
          ? 'bg-red-100 dark:bg-red-900/40' 
          : 'bg-amber-100 dark:bg-amber-900/40'
      }`}>
        {urgency === 'critical' ? (
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
        ) : (
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white text-sm">
          Draft Expiring {urgency === 'critical' ? 'Soon' : 'in ' + timeLeft}
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 truncate">
          "{draftTitle}"
        </p>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="flex-shrink-0 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
        >
          Review
        </button>
      )}
    </div>
  );
};

/**
 * Empty state for no expiring drafts
 */
export const NoDraftsExpiringState: React.FC = () => (
  <div className="text-center py-8">
    <div className="w-12 h-12 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
      <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
    </div>
    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
      No Expiring Drafts
    </h3>
    <p className="text-sm text-gray-500 dark:text-zinc-400">
      All your drafts are up to date!
    </p>
  </div>
);

/**
 * Stats summary component for admin/dashboard
 */
export const DraftExpiryStats: React.FC<{
  total: number;
  expiringSoon: number; // < 7 days
  expiringToday: number; // < 24 hours
  onViewAll?: () => void;
}> = ({ total, expiringSoon, expiringToday, onViewAll }) => (
  <div className="bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">Draft Status</h3>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          View All
        </button>
      )}
    </div>
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
        <div className="text-xs text-gray-500 dark:text-zinc-400">Total Drafts</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{expiringSoon}</div>
        <div className="text-xs text-gray-500 dark:text-zinc-400">Expiring Soon</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{expiringToday}</div>
        <div className="text-xs text-gray-500 dark:text-zinc-400">Expire Today</div>
      </div>
    </div>
  </div>
);

export default {
  DraftExpiryBanner,
  DraftExpiryListItem,
  DraftExpiryNotificationContent,
  NoDraftsExpiringState,
  DraftExpiryStats,
};

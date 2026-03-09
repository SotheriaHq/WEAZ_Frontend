import React, { useRef, useCallback, useState, useEffect } from 'react';
import { AlertTriangle, Monitor, Smartphone, Laptop, RefreshCw, X, Clock, User } from 'lucide-react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import VLoader from '@/components/loaders/VLoader';

/**
 * Draft Conflict Warning Modal (Item #17)
 * 
 * Shows when multiple devices/tabs are editing the same collection draft.
 * Provides options to:
 * - Take over the session (force edit)
 * - Open in read-only mode
 * - Discard local changes and refresh
 * 
 * USAGE:
 * Call the backend draft-session endpoint on load, if conflict detected:
 * <DraftConflictWarningModal
 *   isOpen={hasConflict}
 *   collectionTitle="Summer Collection 2024"
 *   existingSession={{ deviceName: 'Chrome on MacBook', startedAt: new Date(), userId: '...' }}
 *   onTakeOver={handleTakeOver}
 *   onViewReadOnly={handleReadOnly}
 *   onClose={handleClose}
 * />
 */

interface ExistingSession {
  deviceName?: string;
  deviceType?: 'desktop' | 'tablet' | 'mobile';
  startedAt: Date;
  userId?: string;
  userName?: string;
}

interface DraftConflictWarningModalProps {
  isOpen: boolean;
  collectionTitle: string;
  existingSession: ExistingSession;
  onTakeOver: () => void | Promise<void>;
  onViewReadOnly?: () => void;
  onClose: () => void;
  isCurrentUser?: boolean; // True if conflict is from same user's other device
}

const getDeviceIcon = (deviceType?: string) => {
  switch (deviceType) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Monitor;
    case 'desktop':
    default:
      return Laptop;
  }
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

export const DraftConflictWarningModal: React.FC<DraftConflictWarningModalProps> = ({
  isOpen,
  collectionTitle,
  existingSession,
  onTakeOver,
  onViewReadOnly,
  onClose,
  isCurrentUser = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  const [, setTick] = useState(0);
  
  // Update time display every minute
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleTakeOver = useCallback(async () => {
    setIsTakingOver(true);
    try {
      await onTakeOver();
    } finally {
      setIsTakingOver(false);
    }
  }, [onTakeOver]);

  if (!isOpen) return null;

  const DeviceIcon = getDeviceIcon(existingSession.deviceType);
  const timeAgo = formatTimeAgo(existingSession.startedAt);

  return (
    <OverlayPortal>
      <div 
        className="fixed inset-0 z-layer-modal flex items-center justify-center p-4" 
        role="alertdialog" 
        aria-modal="true" 
        aria-labelledby="conflict-title"
        aria-describedby="conflict-description"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          onClick={onClose} 
          aria-hidden 
        />

        {/* Modal */}
        <div 
          ref={dialogRef} 
          tabIndex={-1}
          className="relative w-full max-w-md neu-modal-surface bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden outline-none"
        >
          {/* Warning Header */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="conflict-title" className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                  Draft Already Open
                </h2>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  {isCurrentUser 
                    ? 'This draft is being edited on another device' 
                    : 'Another user is editing this draft'
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors"
              >
                <X className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-5">
            {/* Collection info */}
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-1">
                Collection
              </p>
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {collectionTitle}
              </p>
            </div>

            {/* Session info */}
            <div id="conflict-description" className="flex items-start gap-3 text-sm">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                <DeviceIcon className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">
                  {existingSession.deviceName || 'Unknown Device'}
                </p>
                <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Started editing {timeAgo}</span>
                </div>
                {existingSession.userName && !isCurrentUser && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                    <span>{existingSession.userName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Warning message */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>Warning:</strong> Editing here may cause conflicts. Changes made on the other device could be lost if you take over this session.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-200 dark:border-zinc-800 px-6 py-4 space-y-3">
            <button
              onClick={handleTakeOver}
              disabled={isTakingOver}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white font-medium rounded-xl transition-colors"
            >
              {isTakingOver ? (
                <>
                  <VLoader size={16} progress={61} phase="loading" showLabel={false} />
                  Taking over...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Take Over Session
                </>
              )}
            </button>
            
            {onViewReadOnly && (
              <button
                onClick={onViewReadOnly}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-medium rounded-xl transition-colors"
              >
                View Read-Only
              </button>
            )}
            
            <button
              onClick={onClose}
              className="w-full px-4 py-3 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DraftConflictWarningModal;

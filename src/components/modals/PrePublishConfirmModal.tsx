import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import VLoader from '@/components/loaders/VLoader';

interface CollectionSummary {
  title: string;
  description?: string;
  category?: string;
  categoryEmoji?: string;
  priceRange?: { min?: number; max?: number };
  visibility: 'PUBLIC' | 'PRIVATE';
  type: 'MALE' | 'FEMALE' | 'EVERYBODY';
  tags: string[];
  mediaCount: number;
  videoCount: number;
  coverImageUrl?: string;
  isAvailableInStore?: boolean;
  isMadeToOrder?: boolean;
}

interface PrePublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onEdit: () => void;
  summary: CollectionSummary;
  entityLabel?: 'Collection' | 'Design';
  onViewPublished?: () => void;
}

type ModalState = 'confirm' | 'loading' | 'success';

/**
 * PrePublishConfirmModal
 * 
 * A premium modal that appears when the user clicks "Publish Collection".
 * Shows a summary of the collection before final submission.
 * 
 * States:
 * - confirm: Shows collection summary with Edit/Publish buttons
 * - loading: Shows thread loader while publishing
 * - success: Shows success animation with View/Create Another buttons
 */
const PrePublishConfirmModal: React.FC<PrePublishConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onEdit,
  summary,
  entityLabel = 'Collection',
  onViewPublished,
}) => {
  const [state, setState] = useState<ModalState>('confirm');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('confirm');
      setDescriptionExpanded(false);
      setRedirectCountdown(5);
    }
  }, [isOpen]);

  // Auto-redirect countdown after success
  useEffect(() => {
    if (state === 'success' && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, redirectCountdown]);

  useEffect(() => {
    if (state === 'success' && redirectCountdown === 0) {
      onViewPublished?.();
    }
  }, [state, redirectCountdown, onViewPublished]);

  // Scroll Locking
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  useFocusTrap({
    active: isOpen,
    containerRef: panelRef,
    onEscape: state === 'confirm' ? onClose : undefined,
    initialFocusSelector: '[data-initial-focus="true"]',
  });

  const handlePublish = async () => {
    setState('loading');
    try {
      await onConfirm();
      setState('success');
    } catch {
      setState('confirm');
      // Error toast is handled by parent
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const visibilityLabel = {
    PUBLIC: '🌍 Public',
    PRIVATE: '🔒 Private',
  };

  const audienceLabel = {
    EVERYBODY: 'Everybody',
    MALE: 'Men',
    FEMALE: 'Women',
  };

  const truncatedDescription = summary.description 
    ? summary.description.length > 100 
      ? `${summary.description.slice(0, 100)}...`
      : summary.description
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <OverlayPortal>
          <div className="fixed inset-0 z-layer-modal" aria-hidden={false}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
              onClick={state === 'confirm' ? onClose : undefined}
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-black/40" />
            </motion.div>

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-0 flex items-center justify-center p-4"
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Review before publishing ${entityLabel.toLowerCase()}`}
                tabIndex={-1}
                className="relative flex w-full max-w-[600px] max-h-[90vh] neu-modal-surface flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white/95 dark:border-white/10 dark:bg-gray-900/95 outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header (always visible) */}
                <div className="shrink-0 border-b border-gray-200 dark:border-white/10 px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-serif">Review Your {entityLabel}</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Please review before publishing</p>
                    </div>

                    {state === 'confirm' && (
                      <button
                        type="button"
                        data-initial-focus="true"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full glass-light flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                        aria-label="Close"
                      >
                        ✖️
                      </button>
                    )}
                  </div>
                </div>

                {/* Body (only scroll container) */}
                <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar overscroll-contain px-6 py-5">
                  <AnimatePresence mode="wait">
                    {state === 'confirm' && (
                      <ConfirmContent
                        key="confirm"
                        summary={summary}
                        entityLabel={entityLabel}
                        truncatedDescription={truncatedDescription}
                        descriptionExpanded={descriptionExpanded}
                        setDescriptionExpanded={setDescriptionExpanded}
                        formatPrice={formatPrice}
                        visibilityLabel={visibilityLabel}
                        audienceLabel={audienceLabel}
                      />
                    )}

                    {state === 'loading' && <LoadingContent key="loading" />}

                    {state === 'success' && (
                      <SuccessContent
                        key="success"
                        title={summary.title}
                        entityLabel={entityLabel}
                        redirectCountdown={redirectCountdown}
                        onClose={onClose}
                        onViewPublished={onViewPublished}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer (confirm actions always visible) */}
                {state === 'confirm' && (
                  <div className="shrink-0 border-t border-gray-200 dark:border-white/10 px-6 py-5">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onEdit}
                        className="flex-1 py-3 px-4 rounded-xl glass-light border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                      >
                        ← Edit {entityLabel}
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        className="flex-1 py-3 px-4 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-purple-500/25 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        ✨ Publish Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </OverlayPortal>
      )}
    </AnimatePresence>
  );
};

/**
 * Confirm Content - Shows collection summary
 */
const ConfirmContent: React.FC<{
  summary: CollectionSummary;
  entityLabel: 'Collection' | 'Design';
  truncatedDescription: string | null;
  descriptionExpanded: boolean;
  setDescriptionExpanded: (v: boolean) => void;
  formatPrice: (p: number) => string;
  visibilityLabel: Record<string, string>;
  audienceLabel: Record<string, string>;
}> = ({
  summary,
  entityLabel,
  truncatedDescription,
  descriptionExpanded,
  setDescriptionExpanded,
  formatPrice,
  visibilityLabel,
  audienceLabel,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Cover image preview */}
    {summary.coverImageUrl && (
      <div className="relative rounded-2xl overflow-y-auto mb-4 w-full">
        <MediaRenderer
          kind="image"
          src={summary.coverImageUrl}
          alt={summary.title}
          maxHeightClassName="max-h-[60vh]"
          className="rounded-2xl"
          mediaClassName="rounded-2xl"
        />
        {/* Cover badge */}
        <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-purple-600 text-white text-xs font-medium">
          Cover Image
        </span>
        {/* Media count badge */}
        <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full glass-light backdrop-blur-md text-sm text-white">
          {summary.mediaCount} image{summary.mediaCount !== 1 ? 's' : ''}
          {summary.videoCount > 0 && ` • ${summary.videoCount} video${summary.videoCount !== 1 ? 's' : ''}`}
        </span>
      </div>
    )}

    {/* Summary details */}
    <div className="glass-light rounded-xl p-4 space-y-3 border border-gray-200 dark:border-white/10">
      <SummaryRow label="Title" value={summary.title} />
      
      {summary.category && (
        <SummaryRow 
          label="Category" 
          value={`${summary.categoryEmoji || '📦'} ${summary.category}`} 
        />
      )}

      {(summary.priceRange?.min || summary.priceRange?.max) && (
        <SummaryRow 
          label="Price Range" 
          value={
            summary.priceRange.min && summary.priceRange.max
              ? `${formatPrice(summary.priceRange.min)} - ${formatPrice(summary.priceRange.max)}`
              : summary.priceRange.min
                ? `From ${formatPrice(summary.priceRange.min)}`
                : `Up to ${formatPrice(summary.priceRange.max!)}`
          } 
        />
      )}

      <SummaryRow 
        label="Target Audience" 
        value={audienceLabel[summary.type]} 
      />

      <SummaryRow 
        label="Visibility" 
        value={visibilityLabel[summary.visibility]} 
      />

      {/* Tags */}
      {summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          <span className="text-xs text-gray-500 uppercase tracking-wide w-full mb-1">Tags</span>
          {summary.tags.map((tag) => (
            <span 
              key={tag}
              className="tag-badge px-2 py-1 rounded-full text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>

    {/* Options badges */}
    {(summary.isAvailableInStore || summary.isMadeToOrder) && (
      <div className="flex flex-wrap gap-2 mt-3">
        {summary.isAvailableInStore && (
          <span className="glass-light border border-gray-200 dark:border-white/10 px-3 py-1 rounded-full text-sm text-gray-900 dark:text-white">
            🏪 Physical Store
          </span>
        )}
        {summary.isMadeToOrder && (
          <span className="glass-light border border-gray-200 dark:border-white/10 px-3 py-1 rounded-full text-sm text-gray-900 dark:text-white">
            ✂️ Made to Order
          </span>
        )}
      </div>
    )}

    {/* Description preview */}
    {truncatedDescription && (
      <div className="mt-4">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Description</span>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          {descriptionExpanded ? summary.description : truncatedDescription}
        </p>
        {summary.description && summary.description.length > 100 && (
          <button
            type="button"
            onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 mt-1"
          >
            {descriptionExpanded ? (
              <>
                Show less <span aria-hidden="true">⬆️</span>
              </>
            ) : (
              <>
                Read more <span aria-hidden="true">⬇️</span>
              </>
            )}
          </button>
        )}
      </div>
    )}

    {/* Tip box */}
    {summary.tags.length < 3 && (
      <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
        <span className="text-amber-300 flex-shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
        <p className="text-sm text-amber-300">
          💡 Tip: Adding more tags can help your {entityLabel.toLowerCase()} get discovered
        </p>
      </div>
    )}
  </motion.div>
);

/**
 * SummaryRow - Label/value pair for the summary grid
 */
const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-gray-900 dark:text-white font-medium">{value}</span>
  </div>
);

/**
 * Loading Content - Shows thread loader while publishing
 */
const LoadingContent: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="py-12 flex flex-col items-center justify-center"
  >
    <div className="mb-6">
      <VLoader size={64} progress={66} phase="loading" />
    </div>
    
    <h3 className="text-lg text-gray-900 dark:text-white font-medium mb-1">Publishing your design...</h3>
    <p className="text-sm text-gray-400 mb-4">This may take a moment</p>
    
    {/* Animated dots */}
    <div className="flex gap-1">
      <span className="w-2 h-2 rounded-full bg-purple-500 pulse-dot" />
      <span className="w-2 h-2 rounded-full bg-purple-500 pulse-dot" />
      <span className="w-2 h-2 rounded-full bg-purple-500 pulse-dot" />
    </div>
  </motion.div>
);

/**
 * Success Content - Shows success animation
 */
const SuccessContent: React.FC<{ 
  title: string; 
  entityLabel: 'Collection' | 'Design';
  redirectCountdown: number;
  onClose: () => void;
  onViewPublished?: () => void;
}> = ({ title, entityLabel, redirectCountdown, onClose, onViewPublished }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="py-8 flex flex-col items-center justify-center text-center"
  >
    {/* Success checkmark */}
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
      className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-green-500/30"
    >
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] }}
      >
          <span className="text-4xl" aria-hidden="true">✅</span>
      </motion.div>
    </motion.div>

    <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-serif mb-2">
      Your {entityLabel} is Live! 🎉
    </h2>
    <p className="text-gray-500 dark:text-gray-400 mb-6">
      <span className="text-gray-900 dark:text-white font-medium">{title}</span> has been published
    </p>

    {/* Action buttons */}
    <div className="flex gap-3 w-full max-w-xs">
      <button
        type="button"
        onClick={() => (onViewPublished ? onViewPublished() : onClose())}
        className="flex-1 py-3 px-4 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
      >
        🔗 View {entityLabel}
      </button>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex-1 py-3 px-4 rounded-xl glass-light border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
      >
        Create Another
      </button>
    </div>

    {/* Redirect countdown */}
    <p className="text-xs text-gray-500 mt-4">
      Redirecting in {redirectCountdown}s...
    </p>
  </motion.div>
);

export default PrePublishConfirmModal;

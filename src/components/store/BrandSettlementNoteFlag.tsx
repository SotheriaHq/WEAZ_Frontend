import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  hasSeenBrandSettlementNote,
  markBrandSettlementNoteSeen,
} from '@/utils/storeSetup';

type BrandSettlementNoteFlagProps = {
  userId?: string | null;
  className?: string;
};

const NOTE_COPY =
  'Customer payments are recorded gross. WIEZ retains platform commission, and your net balance releases into payouts as each order milestone is completed.';

const BrandSettlementNoteFlag: React.FC<BrandSettlementNoteFlagProps> = ({
  userId,
  className = '',
}) => {
  const [visible, setVisible] = useState(() => !hasSeenBrandSettlementNote(userId));
  const [dismissedExplicitly, setDismissedExplicitly] = useState(false);

  const dismiss = useCallback(() => {
    markBrandSettlementNoteSeen(userId);
    setDismissedExplicitly(true);
    setVisible(false);
  }, [userId]);

  useEffect(() => {
    if (!visible || dismissedExplicitly) return undefined;
    return () => {
      markBrandSettlementNoteSeen(userId);
    };
  }, [dismissedExplicitly, userId, visible]);

  if (!visible) return null;

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100 ${className}`}
    >
      <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">
        🏦
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
          Brand settlement
        </div>
        <p className="text-sm leading-relaxed">{NOTE_COPY}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-indigo-700 transition-colors hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
        aria-label="Dismiss settlement note"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default BrandSettlementNoteFlag;
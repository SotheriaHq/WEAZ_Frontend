/**
 * "WIEZ has suggested a way to settle this." The shopper's answer.
 *
 * This is the half of mediation that is not an admin's to press. A mediated
 * extension exists precisely because the shopper already refused more time
 * once; applying it over their head would make that refusal — and the whole
 * extension flow behind it — meaningless. So the proposal is put to them, and
 * nothing happens until they answer.
 *
 * Two things the copy has to carry before either button:
 *
 *   - what accepting actually does, in days and dates rather than in the name
 *     of a resolution enum;
 *   - that declining does not end the dispute. Shoppers read "No" next to a
 *     dispute as "give up", and the opposite is true: a refused proposal goes
 *     back to a human at WIEZ with the disagreement still live.
 */
import React, { useState } from 'react';

import type { CustomOrderDispute } from '@/api/CustomOrderApi';

export interface DisputeProposal {
  resolution: string;
  note: string | null;
  extraDays: number | null;
  refundAmount: string | number | null;
  respondByAt: string | null;
}

interface Props {
  dispute: Pick<CustomOrderDispute, 'id'> & { proposal?: DisputeProposal | null };
  busy?: boolean;
  onRespond: (accept: boolean) => void;
}

function describe(proposal: DisputeProposal): string {
  switch (proposal.resolution) {
    case 'MEDIATED_EXTENSION': {
      const days = proposal.extraDays ?? 0;
      return `Your maker gets ${days} more day${days === 1 ? '' : 's'} to finish your piece. Your delivery date moves by the same amount.`;
    }
    case 'REMAKE':
      return 'Your maker remakes the piece. Your order stays open until the new one reaches you.';
    case 'PARTIAL_REFUND':
      return `You keep the order and receive ${proposal.refundAmount ?? 'a partial refund'} back.`;
    default:
      return 'WIEZ has proposed a way to settle this order.';
  }
}

function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return 'This has expired — WIEZ will pick it up from here.';
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} left to answer`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} left to answer`;
}

const DisputeProposalPanel: React.FC<Props> = ({ dispute, busy, onRespond }) => {
  const [answered, setAnswered] = useState<null | boolean>(null);
  const proposal = dispute.proposal;
  if (!proposal) return null;

  const deadline = deadlineLabel(proposal.respondByAt);
  const expired = deadline?.startsWith('This has expired') ?? false;

  return (
    <section
      className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-5"
      aria-labelledby="dispute-proposal-heading"
    >
      <h3
        id="dispute-proposal-heading"
        className="text-base font-semibold text-gray-900 dark:text-white"
      >
        🤝 A way to settle this
      </h3>

      <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
        {describe(proposal)}
      </p>

      {proposal.note ? (
        <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm italic leading-6 text-gray-700 dark:bg-white/5 dark:text-gray-300">
          “{proposal.note}”
          <span className="mt-1 block text-xs not-italic text-gray-500 dark:text-gray-400">
            — WIEZ
          </span>
        </p>
      ) : null}

      {deadline ? (
        <p className="mt-3 text-xs font-medium text-gray-600 dark:text-gray-400">
          ⏳ {deadline}
        </p>
      ) : null}

      {/* Before the buttons, every time. "No" is the one people misread. */}
      <p className="mt-3 text-xs leading-5 text-gray-600 dark:text-gray-400">
        Saying no does not close your dispute or end your order — it goes back
        to the person at WIEZ handling it, and they keep working on it with you.
      </p>

      {answered !== null ? (
        <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
          {answered
            ? '✅ Thanks — we have told your maker and WIEZ.'
            : 'Thanks. WIEZ is picking this back up with your maker.'}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || expired}
            onClick={() => {
              setAnswered(true);
              onRespond(true);
            }}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            Yes, that works
          </button>
          <button
            type="button"
            disabled={busy || expired}
            onClick={() => {
              setAnswered(false);
              onRespond(false);
            }}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
          >
            No — keep looking at it
          </button>
        </div>
      )}
    </section>
  );
};

export default DisputeProposalPanel;

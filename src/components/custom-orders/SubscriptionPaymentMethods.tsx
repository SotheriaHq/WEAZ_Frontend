import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { brandSubscriptionApi } from '@/api/BrandSubscriptionApi';
import { paymentApi } from '@/api/PaymentApi';
import { LEGAL_PAGE_VERSION } from '@/pages/legal/legalVersion';
import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useQueueConfirm } from './useQueueConfirm';

export function SubscriptionPaymentMethods({
  brandId,
  renewalCardId,
  selectedCardId,
  onSelect,
  hasSubscription,
}: {
  brandId: string;
  renewalCardId?: string | null;
  selectedCardId: string;
  onSelect: (id: string) => void;
  hasSubscription: boolean;
}) {
  const client = useQueryClient();
  const cards = useQuery({
    queryKey: ['brand-queue-subscription', brandId, 'cards'],
    queryFn: () => brandSubscriptionApi.cards(brandId),
  });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(false);
  const { confirm, ConfirmDialog } = useQueueConfirm();
  async function mutate(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      setEditing(null);
      void client.invalidateQueries({
        queryKey: ['brand-queue-subscription', brandId],
      });
    } catch (error) {
      toast.error(
        getFriendlyErrorMessage(error, 'Unable to update payment settings.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
      {ConfirmDialog}
      <h2 className="text-lg font-semibold">Payment methods</h2>
      <p className="text-sm">
        Use a card already saved from checkout, or securely add a new card when
        making your next payment. WIEZ shows masked details only. Changing your
        default checkout card does not change your renewal card.
      </p>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="radio"
          name="subscription-card"
          checked={!selectedCardId}
          onChange={() => {
            onSelect('');
            setConsent(false);
          }}
        />
        Pay with a new card in secure checkout
      </label>
      {cards.isPending ? (
        <p role="status">Loading payment methods…</p>
      ) : cards.isError ? (
        <p role="alert">
          Unable to load cards.{' '}
          <button className="queue-button" onClick={() => void cards.refetch()}>
            Retry
          </button>
        </p>
      ) : !cards.data?.length ? (
        <p>
          No saved cards yet. Your card will be saved after a successful
          reusable-card payment.
        </p>
      ) : (
        cards.data.map((card) => (
          <article
            className="space-y-3 border-b border-slate-200 py-4 dark:border-slate-800"
            key={card.id}
          >
            <label className="flex min-h-11 items-start gap-3">
              <input
                type="radio"
                name="subscription-card"
                className="mt-1"
                disabled={!card.reusable || busy}
                checked={selectedCardId === card.id}
                onChange={() => {
                  onSelect(card.id);
                  setConsent(false);
                }}
              />
              <span className="break-words">
                <strong>
                  {card.nickname || card.brand || 'Card'} ···· {card.last4}
                </strong>
                <span className="block text-sm">
                  Expires {card.expMonth}/{card.expYear}
                  {card.isDefault ? ' · Checkout default' : ''}
                  {renewalCardId === card.id ? ' · Subscription renewal' : ''}
                  {!card.reusable
                    ? ' · Reauthorization required at checkout'
                    : ''}
                </span>
              </span>
            </label>
            {editing === card.id ? (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate(
                    () => paymentApi.renameSavedCard(card.id, nickname),
                    'Card nickname updated.',
                  );
                }}
              >
                <label className="text-sm">
                  Card nickname
                  <input
                    value={nickname}
                    maxLength={60}
                    onChange={(event) => setNickname(event.target.value)}
                    className="block w-full border-b border-slate-400 bg-transparent py-2"
                  />
                </label>
                <button className="queue-button" disabled={busy}>
                  Save name
                </button>
                <button
                  type="button"
                  className="queue-button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap gap-4">
                <button
                  disabled={busy}
                  className="queue-button"
                  onClick={() => {
                    setEditing(card.id);
                    setNickname(card.nickname || '');
                  }}
                >
                  Edit nickname
                </button>
                {!card.isDefault ? (
                  <button
                    disabled={busy}
                    className="queue-button"
                    onClick={() =>
                      void mutate(
                        () => paymentApi.setDefaultSavedCard(card.id),
                        'Default checkout card updated.',
                      )
                    }
                  >
                    Make checkout default
                  </button>
                ) : null}
                <button
                  disabled={busy}
                  className="queue-button text-rose-700 dark:text-rose-300"
                  onClick={() =>
                    void confirm({
                      title: 'Delete saved card?',
                      message:
                        'A card used for automatic renewal must be replaced, or renewal stopped, before it can be deleted. Past receipts are retained.',
                      confirmText: 'Delete card',
                      isDestructive: true,
                    }).then((accepted) => {
                      if (accepted)
                        void mutate(async () => {
                          await paymentApi.removeSavedCard(card.id);
                          if (selectedCardId === card.id) onSelect('');
                        }, 'Saved card deleted.');
                    })
                  }
                >
                  Delete
                </button>
              </div>
            )}
          </article>
        ))
      )}
      {hasSubscription && selectedCardId && selectedCardId !== renewalCardId ? (
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              I authorize this card for recurring subscription payments under
              the{' '}
              <Link to="/payment-policy" className="underline">
                Payment and Subscription Policy
              </Link>{' '}
              ({LEGAL_PAGE_VERSION}). This does not restart cancelled renewal.
            </span>
          </label>
          <button
            className="queue-button"
            disabled={!consent || busy}
            onClick={() =>
              void mutate(
                () => brandSubscriptionApi.changeCard(brandId, selectedCardId),
                'Subscription renewal card updated.',
              )
            }
          >
            Use selected card for renewal
          </button>
        </div>
      ) : null}
      <Link
        className="inline-flex min-h-11 items-center text-violet-700 underline dark:text-violet-300"
        to="/checkout"
      >
        Add a new card during checkout
      </Link>
      <p className="text-sm">
        There is no standalone card-verification fee. New card details are
        entered only inside the payment provider’s secure window.
      </p>
    </section>
  );
}

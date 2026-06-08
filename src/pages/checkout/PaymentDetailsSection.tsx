import React from 'react';
import type { PaystackPaymentData, ShippingAddress } from '@/api/StoreApi';
import type {
  CardValidationSessionSummary,
  SavedPaymentCardSummary,
} from '@/api/PaymentApi';
import type { LegalAcceptancePayload } from '@/api/LegalApi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import UniversalSelect from '@/components/forms/UniversalSelect';
import type { PaymentFormErrors } from '@/pages/checkout/paymentFlow';

interface PaymentDetailsSectionProps {
  paymentData: PaystackPaymentData;
  shippingAddress: ShippingAddress;
  errors: PaymentFormErrors;
  onChange: (updater: (current: PaystackPaymentData) => PaystackPaymentData) => void;
  savedCards?: SavedPaymentCardSummary[];
  savedCardsLoading?: boolean;
  savedCardsError?: string | null;
  savedCardMutatingId?: string | null;
  onSetDefaultSavedCard?: (savedCardId: string) => Promise<void> | void;
  onRemoveSavedCard?: (savedCardId: string) => Promise<void> | void;
  cardValidationSession?: CardValidationSessionSummary | null;
  cardValidationLoading?: boolean;
  onStartNewCardCheckout?: () => Promise<void> | void;
  startingNewCardCheckout?: boolean;
  paymentLegalAcceptances?: LegalAcceptancePayload[];
  compact?: boolean;
}

const inputClassName =
  '[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]';
const selectClassName =
  '[&>div>button]:rounded-2xl [&>div>button]:border-white/60 [&>div>button]:bg-white/80 [&>div>button]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&>div>button]:border-white/10 dark:[&>div>button]:bg-white/[0.03]';
const infoCardClassName =
  'rounded-[24px] border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300';

const formatValidationExpiry = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'soon';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const PaymentDetailsSection: React.FC<PaymentDetailsSectionProps> = ({
  paymentData,
  shippingAddress,
  errors,
  onChange,
  savedCards = [],
  savedCardsLoading = false,
  savedCardsError = null,
  savedCardMutatingId = null,
  onSetDefaultSavedCard,
  onRemoveSavedCard,
  cardValidationSession = null,
  cardValidationLoading = false,
  onStartNewCardCheckout,
  startingNewCardCheckout = false,
  paymentLegalAcceptances = [],
  compact = false,
}) => {
  const updateField = <K extends keyof PaystackPaymentData>(
    field: K,
    value: PaystackPaymentData[K],
  ) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  const handleChannelChange = (value: string) => {
    const nextChannel = value as PaystackPaymentData['channel'];
    onChange((current) => ({
      ...current,
      channel: nextChannel,
      ...(nextChannel === 'CARD'
        ? {}
        : {
            useSavedCard: false,
            savedCardId: null,
            savedCardDisplay: null,
          }),
    }));
  };

  const selectSavedCard = (card: SavedPaymentCardSummary) => {
    onChange((current) => ({
      ...current,
      channel: 'CARD',
      useSavedCard: true,
      savedCardId: card.id,
      savedCardDisplay: {
        id: card.id,
        brand: card.brand,
        bank: card.bank,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        reusable: card.reusable,
        lastUsedAt: card.lastUsedAt,
      },
    }));
  };

  const selectNewCard = () => {
    onChange((current) => ({
      ...current,
      channel: 'CARD',
      useSavedCard: false,
      savedCardId: null,
      savedCardDisplay: null,
      saveNewCard: current.saveNewCard ?? true,
    }));
  };

  return (
    <div
      className={`space-y-6 rounded-[28px] border ${
        compact ? 'threadly-chrome-surface p-4' : 'threadly-chrome-surface p-5'
      }`}
    >
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-500 dark:text-fuchsia-300">
          Payment details
        </p>
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">
          Complete your payment details
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enter payer details, reuse a saved card, or open Paystack secure checkout to add a new card.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Payer email"
          type="email"
          value={paymentData.email}
          onChange={(event) => updateField('email', event.target.value)}
          error={errors.email}
          required
          className={inputClassName}
        />
        <Input
          label="Payer phone"
          type="tel"
          value={paymentData.phone}
          onChange={(event) => updateField('phone', event.target.value)}
          error={errors.phone}
          required
          helperText={`Shipping phone on file: ${shippingAddress.phone || 'none yet'}`}
          className={inputClassName}
        />
      </div>

      <div className="space-y-4">
        <UniversalSelect
          label="Payment channel"
          value={paymentData.channel}
          onChange={handleChannelChange}
          options={[
            {
              value: 'CARD',
              label: 'Card',
              description: 'Use a saved card or launch secure checkout to add a new one.',
            },
            {
              value: 'BANK_TRANSFER',
              label: 'Bank transfer',
              description: 'Transfer instructions appear after you continue.',
            },
          ]}
          error={errors.channel}
          className={selectClassName}
        />

        {paymentData.channel === 'CARD' ? (
          <div className="space-y-3 rounded-[24px] border border-dashed border-slate-200/80 p-4 dark:border-white/10">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Saved cards</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Choose a previously used card or continue with a new card.
              </p>
            </div>

            {cardValidationLoading ? (
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-3 py-3 text-xs text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100">
                Checking saved-card eligibility before secure checkout...
              </div>
            ) : cardValidationSession?.status === 'VALIDATED' ? (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                Saved-card validation is complete for this checkout.
                {` Session expires at ${formatValidationExpiry(cardValidationSession.expiresAt)}.`}
              </div>
            ) : null}

            {savedCardsLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading saved cards...</p>
            ) : savedCards.length > 0 ? (
              <div className="space-y-2">
                {savedCards.map((card) => {
                  const isSelected =
                    paymentData.useSavedCard && paymentData.savedCardId === card.id;
                  const isMutating = savedCardMutatingId === card.id;
                  const brand = card.brand || 'Card';
                  const bank = card.bank ? ` (${card.bank})` : '';
                  return (
                    <div
                      key={card.id}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-fuchsia-400/80 bg-fuchsia-50/70 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10'
                          : 'border-slate-200/80 bg-white/70 hover:border-fuchsia-300 dark:border-white/10 dark:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => selectSavedCard(card)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {brand}
                            {bank} ending {card.last4}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {card.expMonth && card.expYear
                              ? `Exp ${card.expMonth}/${card.expYear}`
                              : 'Expiration unavailable'}
                            {card.reusable ? ' · Reusable' : ''}
                            {card.isDefault ? ' · Default' : ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          {!card.isDefault && onSetDefaultSavedCard ? (
                            <button
                              type="button"
                              onClick={() => {
                                void onSetDefaultSavedCard(card.id);
                              }}
                              disabled={Boolean(savedCardMutatingId)}
                              className="rounded-full border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition-colors hover:border-fuchsia-300 hover:text-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:text-slate-300"
                            >
                              {isMutating ? 'Saving...' : 'Default'}
                            </button>
                          ) : null}
                          {onRemoveSavedCard ? (
                            <button
                              type="button"
                              onClick={() => {
                                void onRemoveSavedCard(card.id);
                              }}
                              disabled={Boolean(savedCardMutatingId)}
                              className="rounded-full border border-rose-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-600 transition-colors hover:border-rose-400 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300"
                            >
                              {isMutating ? 'Removing...' : 'Remove'}
                            </button>
                          ) : null}
                          <span className="text-lg" aria-hidden>
                            {isSelected ? '✅' : '💳'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={infoCardClassName}>
                <p className="font-semibold text-slate-900 dark:text-white">No saved cards yet</p>
                <p className="mt-1">
                  Complete one successful card payment and WEAZ will show it here for faster reuse.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={selectNewCard}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                paymentData.useSavedCard
                  ? 'border-slate-200/80 bg-white/70 hover:border-fuchsia-300 dark:border-white/10 dark:bg-white/[0.03]'
                  : 'border-fuchsia-400/80 bg-fuchsia-50/70 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Add a new card securely</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    WEAZ will prepare Paystack checkout and you will enter card details there.
                  </p>
                </div>
                <span className="text-lg" aria-hidden>
                  {paymentData.useSavedCard ? '💳' : '✅'}
                </span>
              </div>
            </button>

            {!paymentData.useSavedCard ? (
              <div className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.02]">
                <label className="flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(paymentData.saveNewCard ?? true)}
                    onChange={(event) => updateField('saveNewCard', event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30"
                  />
                  <span>
                    Save this card for faster checkout next time when Paystack confirms it as reusable.
                  </span>
                </label>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  WEAZ will prepare Paystack secure checkout inside this flow. Enter card number,
                  expiry, CVV, PIN, or OTP only inside the secure payment window that opens next.
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    void onStartNewCardCheckout?.();
                  }}
                  loading={startingNewCardCheckout}
                  disabled={!onStartNewCardCheckout || startingNewCardCheckout}
                  className="w-full rounded-2xl px-5 shadow-[0_16px_36px_rgba(217,70,239,0.24)]"
                >
                  {startingNewCardCheckout ? 'Preparing payment...' : 'Add new card securely'}
                </Button>
              </div>
            ) : null}

            {savedCardsError ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">{savedCardsError}</p>
            ) : null}
            {paymentData.useSavedCard && errors.validationSessionId ? (
              <p className="text-xs text-red-500">{errors.validationSessionId}</p>
            ) : null}
            {errors.savedCardId ? (
              <p className="text-xs text-red-500">{errors.savedCardId}</p>
            ) : null}
          </div>
        ) : null}

        {paymentData.channel === 'BANK_TRANSFER' ? (
          <div className={infoCardClassName}>
            <p className="font-semibold text-slate-900 dark:text-white">Transfer instructions</p>
            <p className="mt-1">
              Exact transfer account details and reference will be shown on the next secure step.
            </p>
          </div>
        ) : null}
      </div>

      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
        <input
          type="checkbox"
          checked={paymentData.consentAccepted}
          onChange={(event) => {
            const checked = event.target.checked;
            onChange((current) => ({
              ...current,
              consentAccepted: checked,
              legalAcceptances: checked ? paymentLegalAcceptances : [],
            }));
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30"
        />
        <span>
          I confirm these payment details are correct, and I understand this payment can require
          issuer verification, provider challenges, or delayed confirmation before the order is
          fulfilled. If I add a new card, the details will be entered only inside the secure
          Paystack checkout window.
          {errors.consentAccepted ? (
            <span className="mt-1 block text-xs text-red-500">{errors.consentAccepted}</span>
          ) : null}
        </span>
      </label>
    </div>
  );
};

export default PaymentDetailsSection;

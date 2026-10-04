import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import { detectCardBrand, formatCardNumberInput } from '@/pages/checkout/paymentFlow';

/**
 * Save a card for next time — without the card ever leaving this component.
 *
 * The buyer types a card number because that is how a person identifies their
 * own card. It is used HERE, in the browser, for two things only: to work out
 * the brand and to take the last four digits. What is sent to WIEZ is that
 * fingerprint and the expiry. The number is never put in a request, never put
 * in state that outlives this form, and is cleared on success.
 *
 * The money does not move through this form. Payment runs in Paystack's own
 * window, which is also the only thing that can return a reusable
 * authorization — so a card saved here is a NAME the buyer will recognise on
 * their next checkout, not a chargeable token. The copy says so rather than
 * letting them assume otherwise and wonder why they are asked again.
 *
 * Layout is fixed: every field is the same height, the button holds its width
 * through "Save card" → "Saving…", and the error line occupies its row whether
 * or not there is an error — so nothing in the checkout moves while this is
 * being filled in.
 */

const FIELD =
  'h-11 w-full rounded-xl bg-black/[0.03] px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:bg-white/[0.06] dark:text-white dark:focus-visible:ring-white/20';
const LABEL =
  'text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400';

/** Luhn. Catches a mistyped digit before the buyer is told it "did not save". */
const passesLuhn = (digits: string): boolean => {
  if (digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
};

export interface SaveCardFormProps {
  /** Fired with the refreshed saved-card list. */
  onSaved?: (cards: unknown) => void;
  onCancel?: () => void;
}

export const SaveCardForm: React.FC<SaveCardFormProps> = ({ onSaved, onCancel }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holderName, setHolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = useMemo(() => cardNumber.replace(/\D/g, ''), [cardNumber]);
  const brand = useMemo(() => detectCardBrand(digits), [digits]);

  const handleExpiry = useCallback((raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 4);
    setExpiry(clean.length > 2 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean);
  }, []);

  const submit = useCallback(async () => {
    setError(null);

    if (!passesLuhn(digits)) {
      setError('Check the card number.');
      return;
    }
    const [monthRaw, yearRaw] = expiry.split('/');
    const month = (monthRaw ?? '').padStart(2, '0');
    const year = yearRaw ?? '';
    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^[0-9]{2}$/.test(year)) {
      setError('Check the expiry date.');
      return;
    }

    setBusy(true);
    try {
      /*
        The ONLY thing that crosses the network. `digits` is read here for its
        last four and is not included — if this object ever grows a card
        number field, the server rejects the request outright
        (`forbidNonWhitelisted`), which is the backstop for this comment.
      */
      const response = await apiClient.post('/payment/saved-cards/record', {
        last4: digits.slice(-4),
        expMonth: month,
        expYear: `20${year}`,
        ...(brand ? { brand } : {}),
      });
      setCardNumber('');
      setExpiry('');
      setHolderName('');
      onSaved?.(response.data?.data ?? response.data);
      toast.success('Card saved for next time.');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not save that card.';
      setError(Array.isArray(message) ? message[0] : message);
    } finally {
      setBusy(false);
    }
  }, [brand, digits, expiry, onSaved]);

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL} htmlFor="save-card-number">
          Card number {brand ? `· ${brand}` : ''}
        </label>
        <input
          id="save-card-number"
          value={formatCardNumberInput(cardNumber)}
          onChange={(event) => setCardNumber(event.target.value)}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          disabled={busy}
          className={`${FIELD} mt-1.5`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="save-card-expiry">
            Expiry
          </label>
          <input
            id="save-card-expiry"
            value={expiry}
            onChange={(event) => handleExpiry(event.target.value)}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            disabled={busy}
            className={`${FIELD} mt-1.5`}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="save-card-name">
            Name on card
          </label>
          <input
            id="save-card-name"
            value={holderName}
            onChange={(event) => setHolderName(event.target.value)}
            autoComplete="cc-name"
            placeholder="Optional"
            disabled={busy}
            className={`${FIELD} mt-1.5`}
          />
        </div>
      </div>

      {/* Holds its row whether or not there is an error, so the button below
          never moves out from under the cursor. */}
      <p
        role={error ? 'alert' : undefined}
        className={`min-h-[18px] text-xs ${
          error ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {error ??
          'We keep the brand, last four digits and expiry. Payment happens in Paystack’s window.'}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || digits.length < 12}
          className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Saving…' : 'Save card'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-11 min-w-[92px] items-center justify-center rounded-xl bg-black/[0.05] px-4 text-sm font-semibold text-slate-700 transition hover:bg-black/[0.08] disabled:opacity-60 dark:bg-white/10 dark:text-slate-200"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default SaveCardForm;

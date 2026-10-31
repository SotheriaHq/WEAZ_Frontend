import { Select } from '@/components/ui/Select';
import { useId, useMemo } from 'react';
import {
  AUTO_CURRENCY,
  BASE_CURRENCY,
  setDisplayCurrencyPreference,
  useDisplayCurrency,
} from '@/currency/displayCurrency';

const currencyName = (() => {
  try {
    const names = new Intl.DisplayNames(undefined, { type: 'currency' });
    return (code: string) => names.of(code) ?? code;
  } catch {
    return (code: string) => code;
  }
})();

/**
 * Which currency prices are shown in. Display only: the shopper always pays in
 * Naira, and brands are always paid in Naira.
 */
export default function CurrencySettings() {
  const selectId = useId();
  const current = useDisplayCurrency();
  const { data, preference } = current;
  const options = useMemo(
    () =>
      Object.keys(data?.rates ?? {})
        .map((code) => ({ code, name: currencyName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );
  const display = data?.displayCurrency ?? BASE_CURRENCY;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-[var(--text-primary)]">Currency</h1>
        <p className="text-[var(--text-secondary)]">
          See prices in your own currency. You always pay in Naira (NGN), and other currencies are
          estimates at today&apos;s rate.
        </p>
      </div>

      <section className="space-y-3">
        <label htmlFor={selectId} className="block text-sm font-semibold text-[var(--text-primary)]">
          Show prices in
        </label>
        <Select
          id={selectId}
          value={preference}
          onChange={(event) => void setDisplayCurrencyPreference(event.target.value)}
          className="max-w-md"
        >
          <option value={AUTO_CURRENCY}>Automatic (based on your country)</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} ({option.code})
            </option>
          ))}
        </Select>
        <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
          {!data
            ? 'Prices show in Naira while currency estimates load.'
            : data.needsCurrencyChoice
              ? 'Your country uses more than one currency. Choose the one you want to see.'
              : display === BASE_CURRENCY
                ? 'Prices show in Naira.'
                : `Prices show in Naira with an estimate in ${currencyName(display)}.`}
          {data?.isStale ? ' Rates are from earlier; estimates may be less accurate.' : null}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          Automatic uses the country your connection comes from. We don&apos;t ask for your location
          and don&apos;t store it. Your choice is saved on this device.
        </p>
      </section>
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  BASE_CURRENCY,
  estimateInDisplayCurrency,
  foreignDisplayCurrency,
  formatMoneyAmount,
  useDisplayCurrency,
} from './displayCurrency';

type PriceEstimateProps = {
  amount: number | null | undefined;
  currency?: string | null;
  className?: string;
};

/** "≈ £27" under a Naira price, for shoppers who read another currency. */
export function PriceEstimate({ amount, currency, className }: PriceEstimateProps) {
  const current = useDisplayCurrency();
  const estimate = estimateInDisplayCurrency(current, amount, currency);
  if (!estimate) return null;
  return (
    <span
      className={className ?? 'block text-xs font-medium text-[var(--text-secondary)]'}
      title="Estimate. You pay in Naira (NGN)."
    >
      <span aria-hidden="true">≈ </span>
      <span className="sr-only">About </span>
      {estimate}
    </span>
  );
}

/** States the Naira charge at checkout whenever prices are read in another currency. */
export function ChargeCurrencyNotice({ total, currency }: { total: number; currency?: string | null }) {
  const current = useDisplayCurrency();
  const display = foreignDisplayCurrency(current);
  const estimate = estimateInDisplayCurrency(current, total, currency);
  if (!display || !estimate) return null;
  return (
    <p className="text-xs leading-5 text-[var(--text-secondary)]">
      You&apos;ll pay {formatMoneyAmount(total, BASE_CURRENCY)} in Naira. About {estimate} at
      today&apos;s rate; your bank sets the final amount.{' '}
      <Link to="/settings?tab=currency" className="font-semibold underline underline-offset-2">
        Change currency
      </Link>
    </p>
  );
}

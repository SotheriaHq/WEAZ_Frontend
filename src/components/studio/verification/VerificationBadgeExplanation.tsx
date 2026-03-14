import { Link, useLocation } from 'react-router-dom';

interface VerificationBadgeExplanationProps {
  triggerClassName?: string;
}

export default function VerificationBadgeExplanation({
  triggerClassName = '',
}: VerificationBadgeExplanationProps) {
  const location = useLocation();

  return (
    <Link
      to="/help/verified-badge"
      state={{
        from:
          `${location.pathname}${location.search}${location.hash}` ||
          '/studio/verification',
      }}
      className={`inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 ${triggerClassName}`}
    >
      ✅ Badge meaning
    </Link>
  );
}

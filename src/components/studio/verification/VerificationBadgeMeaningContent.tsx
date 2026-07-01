interface VerificationBadgeMeaningContentProps {
  compact?: boolean;
}

export default function VerificationBadgeMeaningContent({
  compact = false,
}: VerificationBadgeMeaningContentProps) {
  const wrapperClass = compact
    ? 'space-y-2 text-xs leading-6 text-gray-700'
    : 'space-y-4 text-sm leading-7 text-gray-700';

  const sectionClass = compact
    ? 'rounded-2xl p-3'
    : 'rounded-[1.5rem] p-5';

  const headingClass = compact
    ? 'text-[10px] font-semibold uppercase tracking-[0.18em]'
    : 'text-xs font-semibold uppercase tracking-[0.22em]';

  return (
    <div className={wrapperClass}>
      <section className={`${sectionClass} border border-emerald-200 bg-emerald-50`}>
        <p className={`${headingClass} text-emerald-700`}>
          What it means
        </p>
        <p className={compact ? 'mt-2' : 'mt-3'}>
          WIEZ reviewed the brand&apos;s submitted identity and business
          evidence, approved the current store record, and keeps that badge tied
          to the live account state.
        </p>
      </section>

      <section className={`${sectionClass} border border-gray-200 bg-white shadow-sm`}>
        <p className={`${headingClass} text-gray-500`}>
          What it does not mean
        </p>
        <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
          <p>It is not a product quality guarantee.</p>
          <p>It is not a payment guarantee or escrow promise.</p>
          <p>It does not remove the need for buyers to review item details.</p>
        </div>
      </section>

      <section className={`${sectionClass} border border-amber-200 bg-amber-50`}>
        <p className={`${headingClass} text-amber-700`}>
          Why it may disappear
        </p>
        <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
          <p>The store closes or is no longer public.</p>
          <p>The owner account becomes inactive or deactivated.</p>
          <p>The verification status changes after review or re-verification.</p>
        </div>
      </section>
    </div>
  );
}

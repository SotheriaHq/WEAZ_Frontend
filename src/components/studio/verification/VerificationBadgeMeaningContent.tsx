export default function VerificationBadgeMeaningContent() {
  return (
    <div className="space-y-4 text-sm leading-7 text-gray-700">
      <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
          What it means
        </p>
        <p className="mt-3">
          Threadly reviewed the brand&apos;s submitted identity and business
          evidence, approved the current store record, and keeps that badge tied
          to the live account state.
        </p>
      </section>

      <section className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
          What it does not mean
        </p>
        <div className="mt-3 space-y-3">
          <p>It is not a product quality guarantee.</p>
          <p>It is not a payment guarantee or escrow promise.</p>
          <p>It does not remove the need for buyers to review item details.</p>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
          Why it may disappear
        </p>
        <div className="mt-3 space-y-3">
          <p>The store closes or is no longer public.</p>
          <p>The owner account becomes inactive or deactivated.</p>
          <p>The verification status changes after review or re-verification.</p>
        </div>
      </section>
    </div>
  );
}

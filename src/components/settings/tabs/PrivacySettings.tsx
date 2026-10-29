import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { browserOptsOutOfTracking, openConsentSettings, useConsent } from '@/privacy/consent';

const describe = (on: boolean) => (on ? 'On' : 'Off');

/**
 * Privacy home: what this browser allows, in plain words, and where to change
 * it. The choices themselves live in the cookie banner, so there is one place
 * that edits them.
 */
export default function PrivacySettings() {
  const { record, decided } = useConsent();
  const browserOptOut = browserOptsOutOfTracking();
  const rows = [
    { label: 'Essential', value: 'Always on', note: 'Sign-in, security, your bag and settings.' },
    {
      label: 'Analytics',
      value: browserOptOut ? 'Off (your browser asks not to be tracked)' : describe(record?.analytics === true),
      note: 'Visit counts and page speed, so we know what to improve.',
    },
    {
      label: 'Faster Google sign-in',
      value: describe(record?.thirdPartySignIn === true),
      note: 'Prepares “Continue with Google” when you open sign-in.',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-[var(--text-primary)]">Privacy</h1>
        <p className="text-[var(--text-secondary)]">
          Choose what WIEZ may use on this device, and who can see your profile.
        </p>
      </div>

      <section aria-labelledby="privacy-cookies-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="privacy-cookies-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Cookie preferences
          </h2>
          <Button variant="secondary" size="sm" onClick={openConsentSettings}>
            Change cookie settings
          </Button>
        </div>
        {!decided ? (
          <p className="text-sm text-[var(--text-secondary)]">
            You haven’t chosen yet, so only essential cookies are in use.
          </p>
        ) : null}
        <dl className="divide-y divide-[var(--border-default)] rounded-2xl border border-[var(--border-default)]">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <dt className="text-sm font-semibold text-[var(--text-primary)]">{row.label}</dt>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{row.note}</p>
              </div>
              <dd className="text-sm font-semibold text-[var(--text-primary)]">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-[var(--text-secondary)]">
          Your choice is saved on this device only. Read the{' '}
          <Link to="/cookies" className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
            cookie policy
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="privacy-profile-title" className="space-y-2">
        <h2 id="privacy-profile-title" className="text-lg font-semibold text-[var(--text-primary)]">
          Profile visibility
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Decide what other people can see on your profile.
        </p>
        <Link
          to="/settings?tab=profile-visibility"
          className="inline-flex text-sm font-semibold text-[var(--text-primary)] underline underline-offset-2"
        >
          Open profile visibility
        </Link>
      </section>
    </div>
  );
}

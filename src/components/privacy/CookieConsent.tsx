import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Switch from '@/components/ui/Switch';
import {
  OPTIONAL_OFF,
  OPTIONAL_ON,
  closeConsentSettings,
  saveConsent,
  useConsent,
  type ConsentChoices,
} from '@/privacy/consent';

type OptionalPurpose = {
  key: keyof ConsentChoices;
  title: string;
  description: string;
};

/** Plain-language purposes. Each maps to code in privacy/thirdPartyLoaders. */
const OPTIONAL_PURPOSES: OptionalPurpose[] = [
  {
    key: 'analytics',
    title: 'Analytics',
    description:
      'Counts visits and how fast pages load, so we know what to improve. No ads, and never sold.',
  },
  {
    key: 'thirdPartySignIn',
    title: 'Faster Google sign-in',
    description:
      'Gets “Continue with Google” ready as soon as you open sign-in. When off, Google loads only after you choose it.',
  },
];

/**
 * Cookie choice. Shown until the visitor decides, and again whenever they ask
 * to review it. Rejecting is exactly as easy as accepting, nothing optional is
 * pre-selected, and nothing optional runs before a choice is saved.
 */
export default function CookieConsent() {
  const { decided, settingsOpen, record } = useConsent();
  const [view, setView] = useState<'summary' | 'choices'>('summary');
  const [choices, setChoices] = useState<ConsentChoices>(OPTIONAL_OFF);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const visible = !decided || settingsOpen;

  // Reopened to review: start on the switches, showing what was saved.
  useEffect(() => {
    if (!settingsOpen) return;
    setChoices(record ? { analytics: record.analytics, thirdPartySignIn: record.thirdPartySignIn } : OPTIONAL_OFF);
    setView('choices');
    headingRef.current?.focus();
  }, [settingsOpen, record]);

  // Escape closes a review; a first visit still needs an answer.
  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeConsentSettings();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen]);

  if (!visible) return null;

  const showChoices = view === 'choices';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="fixed inset-x-0 bottom-0 z-[1300] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:px-0 sm:pb-0"
    >
      <Card
        glass
        padding="lg"
        className="mx-auto w-full max-w-[26rem] text-[var(--text-primary)] motion-safe:animate-[fadeIn_200ms_ease-out]"
      >
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-bold tracking-tight focus:outline-none"
        >
          {showChoices ? 'Choose your cookies' : 'Your privacy, your choice'}
        </h2>

        {showChoices ? (
          <div id={bodyId}>
            <ul className="mt-4 space-y-4">
              <li className="flex items-start justify-between gap-4">
                <div>
                  <p id={`${titleId}-essential`} className="text-sm font-semibold">
                    Essential
                  </p>
                  <p id={`${titleId}-essential-text`} className="mt-0.5 text-sm text-[var(--text-secondary)]">
                    Keeps you signed in, protects your account and remembers your bag and settings.
                    Always on.
                  </p>
                </div>
                <Switch
                  checked
                  disabled
                  onChange={() => undefined}
                  labelledBy={`${titleId}-essential`}
                  describedBy={`${titleId}-essential-text`}
                />
              </li>
              {OPTIONAL_PURPOSES.map((purpose) => (
                <li key={purpose.key} className="flex items-start justify-between gap-4">
                  <div>
                    <p id={`${titleId}-${purpose.key}`} className="text-sm font-semibold">
                      {purpose.title}
                    </p>
                    <p
                      id={`${titleId}-${purpose.key}-text`}
                      className="mt-0.5 text-sm text-[var(--text-secondary)]"
                    >
                      {purpose.description}
                    </p>
                  </div>
                  <Switch
                    checked={choices[purpose.key]}
                    onChange={(next) => setChoices((current) => ({ ...current, [purpose.key]: next }))}
                    labelledBy={`${titleId}-${purpose.key}`}
                    describedBy={`${titleId}-${purpose.key}-text`}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => saveConsent(choices)}>
                Save choices
              </Button>
              <Button variant="primary" size="sm" onClick={() => saveConsent(OPTIONAL_ON)}>
                Accept all
              </Button>
            </div>
            {decided ? (
              <Button variant="ghost" size="sm" fullWidth className="mt-2" onClick={closeConsentSettings}>
                Close without changes
              </Button>
            ) : (
              <Button variant="ghost" size="sm" fullWidth className="mt-2" onClick={() => setView('summary')}>
                Back
              </Button>
            )}
          </div>
        ) : (
          <div>
            <p id={bodyId} className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              WIEZ uses essential cookies to keep you signed in, protect your account and remember
              your bag. With your OK, we’d also like to measure visits so we can make WIEZ faster. We
              never sell your data.{' '}
              <Link to="/cookies" className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
                Cookie policy
              </Link>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => saveConsent(OPTIONAL_ON)}>
                Accept all
              </Button>
              <Button variant="primary" size="sm" onClick={() => saveConsent(OPTIONAL_OFF)}>
                Reject optional
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              className="mt-2"
              onClick={() => setView('choices')}
            >
              Choose what to allow
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

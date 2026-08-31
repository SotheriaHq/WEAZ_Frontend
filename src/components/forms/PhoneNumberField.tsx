import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CountryCode } from 'libphonenumber-js';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  checkPhoneCompleteness,
  formatAsYouType,
  getDialCode,
  getExampleNationalNumber,
  PHONE_COUNTRIES,
  splitE164,
} from '@/utils/phoneCountries';

/**
 * Tailwind's `md` breakpoint in this project is 640px (see tailwind.config.js —
 * the scale is shifted, `sm` is 480). Kept in JS because the trigger's label is
 * a string prop on `UniversalSelect`, so a CSS-only swap is not available.
 */
const COUNTRY_NAME_MIN_WIDTH = '(min-width: 640px)';

/**
 * Flags are IMAGES, not emoji.
 *
 * `PHONE_COUNTRIES[].flag` is a regional-indicator pair (🇳🇬 = U+1F1F3 U+1F1EC).
 * **Windows ships no flag glyphs at all** — not in Segoe UI Emoji, not anywhere
 * — so every browser on Windows falls back to drawing the two letters. That is
 * why the picker read "NG Nigeria" and looked like it was still printing a
 * country code: the "NG" *was* the flag, failing. No amount of styling fixes
 * that, because there is no glyph to style.
 *
 * `public/flags/` holds the 4x3 SVG set (271 files, ~2.4MB). Served as static
 * assets rather than bundled: the bundler would inline the small ones into the
 * CSS as base64 and emit the rest as hashed chunks, when what we want is 271
 * cache-forever files of which any one page fetches one or two. `loading="lazy"`
 * keeps the open list from requesting all of them at once.
 */
const CountryFlag: React.FC<{ iso2: string; title?: string }> = ({
  iso2,
  title,
}) => (
  /*
    `no-raw-media-elements` guards UPLOADED media, so that everything a brand
    posts flows through `MediaRenderer` and keeps its intrinsic sizing. A 20px
    flag is chrome, not content, and `MediaRenderer` would resolve signed URLs
    and apply the uncropped-media invariant to a fixed-ratio icon.

    A CSS background would sidestep the rule without an exemption, and was the
    first thing tried — but background images have no lazy loading, so opening
    the picker would fetch all 271 flags (~2.4MB) at once. `loading="lazy"` on a
    real <img> fetches the eight or so actually on screen.
  */
  // eslint-disable-next-line threadly/no-raw-media-elements
  <img
    src={`/flags/${iso2.toLowerCase()}.svg`}
    alt=""
    title={title}
    loading="lazy"
    width={20}
    height={15}
    className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10 dark:ring-white/15"
    onError={(event) => {
      // libphonenumber knows a few territories the flag set does not. Losing
      // the flag is survivable; a broken-image icon in a form is not.
      event.currentTarget.style.visibility = 'hidden';
    }}
  />
);

const matchMedia = (query: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;

const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = matchMedia(query);
      if (!list) return () => {};
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => matchMedia(query)?.matches ?? false,
    [query],
  );
  // Server snapshot is `false`, i.e. the compact label. A first paint that is
  // narrower than the final one settles outward without reflowing neighbours.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

/**
 * Phone entry with an explicit country code and per-country completeness rules.
 *
 * Before this, phone fields were a bare `<input type="tel">` validated against a
 * single hardcoded default country (NG). Two things went wrong with that: a
 * non-Nigerian user had no way to say which country their number belonged to,
 * and a Nigerian who typed their number the way it is printed (0803…, 11 digits)
 * got no guidance about the trunk zero that has to be dropped once a country
 * code is attached.
 *
 * The country code is now a first-class, visible part of the value, and the
 * error text names the country and the digit count instead of just "invalid".
 */
interface PhoneNumberFieldProps {
  label?: string;
  /** Stored value in E.164 (e.g. '+2348031234567'). */
  value: string;
  /** Emits E.164 when complete, otherwise the raw partial for draft-saving. */
  onChange: (e164OrPartial: string, isValid: boolean) => void;
  /** Seeds the country picker, e.g. from the profile's selected country. */
  defaultCountry?: CountryCode;
  required?: boolean;
  disabled?: boolean;
  /** External error (e.g. from a form resolver) shown when local input is untouched. */
  error?: string;
  helperText?: string;
  menuLayer?: 'dropdown' | 'modal';
  className?: string;
  inputId?: string;
}

const PhoneNumberField: React.FC<PhoneNumberFieldProps> = ({
  label = 'Phone Number',
  value,
  onChange,
  defaultCountry = 'NG',
  required = false,
  disabled = false,
  error,
  helperText,
  menuLayer = 'modal',
  className = '',
  inputId,
}) => {
  const initial = useMemo(
    () => splitE164(value, defaultCountry),
    // Seeded once; the field owns its state after mount so remote refreshes
    // cannot yank half-typed digits out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [iso2, setIso2] = useState<CountryCode>(initial.iso2);
  const [nationalNumber, setNationalNumber] = useState(initial.nationalNumber);
  const [touched, setTouched] = useState(false);
  const compactCountryLabel = !useMediaQuery(COUNTRY_NAME_MIN_WIDTH);
  const dialCodeId = inputId ? `${inputId}-dial-code` : undefined;

  // Adopt a country the parent supplies only while the field is still empty —
  // e.g. the user picks "Ghana" in the profile form before typing a number.
  useEffect(() => {
    if (!nationalNumber && defaultCountry && defaultCountry !== iso2) {
      setIso2(defaultCountry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountry]);

  const completeness = useMemo(
    () => checkPhoneCompleteness(nationalNumber, iso2),
    [nationalNumber, iso2],
  );

  const emit = (nextNational: string, nextIso2: CountryCode) => {
    const result = checkPhoneCompleteness(nextNational, nextIso2);
    onChange(
      result.e164 ??
        (nextNational ? `${getDialCode(nextIso2)}${nextNational}` : ''),
      result.isValid,
    );
  };

  /**
   * The picker names a COUNTRY; the field shows the dial code. Never both.
   *
   * They used to show the same thing side by side — the trigger read "🇳🇬 +234"
   * with "+234" printed again two millimetres to its right, inside the input.
   * Repeating it is not just noise: it reads as two separate inputs, and a
   * reader who has been shown a code twice reasonably wonders whether they are
   * expected to type it a third time.
   *
   * So the country is the only thing the picker says, and the code appears
   * exactly once, in the place it actually applies to.
   *
   * Below `md` the trigger is too narrow for "United Arab Emirates", and a
   * truncated country name is a country name you cannot read. It falls back to
   * the ISO 3166-1 alpha-2 code beside the flag, and the full name moves into
   * the option's second line so the OPEN LIST is always browsable — a compact
   * trigger must never make the list itself unreadable. Both forms stay
   * searchable either way; `UniversalSelect` matches label, description and
   * value, so "Nigeria", "NG" and "234" all still find the same row.
   */
  const countryOptions = useMemo(
    () =>
      PHONE_COUNTRIES.map((country) => ({
        value: country.iso2,
        // The flag is the `icon`, so it renders on the trigger AND in the list
        // without being part of the searchable text. The label is the country
        // and nothing else.
        icon: <CountryFlag iso2={country.iso2} title={country.name} />,
        label: compactCountryLabel ? country.iso2 : country.name,
        description: compactCountryLabel
          ? `${country.name} · +${country.callingCode}`
          : `+${country.callingCode}`,
      })),
    [compactCountryLabel],
  );

  const placeholder = useMemo(
    () => getExampleNationalNumber(iso2) || 'Phone number',
    [iso2],
  );

  const showError =
    touched && !completeness.isEmpty && Boolean(completeness.error);
  const showRequired = touched && required && completeness.isEmpty;
  const visibleError = showError
    ? completeness.error
    : showRequired
      ? 'Phone number is required'
      : !touched
        ? error
        : undefined;

  return (
    <div className={`space-y-2 w-full max-w-full overflow-hidden ${className}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-theme-secondary"
        >
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </label>
      ) : null}

      <div className="flex items-center gap-2 w-full min-w-0">
        <UniversalSelect
          value={iso2}
          onChange={(next) => {
            const nextIso2 = next as CountryCode;
            setIso2(nextIso2);
            setTouched(true);
            emit(nationalNumber, nextIso2);
          }}
          options={countryOptions}
          searchable
          searchPlaceholder="Search country or code…"
          emptyMessage="No matching country"
          disabled={disabled}
          menuLayer={menuLayer}
          /*
            The picker is the SMALLER of the two controls. The number is what
            someone actually types, so it gets the remaining width — the other
            way round left about 200px to type a phone number into.

            `compact` is deliberately NOT set: it renders px-3/py-2/text-xs,
            roughly 32px tall, beside an h-12 input. That height difference is
            why the pair read as two separate rows instead of one control. The
            default size lands at ~48px and lines up.
          */
          className="w-[6.75rem] md:w-[10rem] shrink-0"
          fitContent={false}
        />

        <div className="relative flex-1 min-w-0">
          {/*
            The dial code is derived, never typed. It is a `<span>` rather than
            a disabled input on purpose: a disabled input is still a tab stop in
            some browsers and reads to a screen reader as a field the user has
            failed to fill in, when in fact there is nothing here to fill in.
            The divider is what says "this part is not yours to edit" — the
            country picker to its left is where it changes.
          */}
          <span
            id={dialCodeId}
            className="pointer-events-none absolute left-0 top-1/2 flex h-6 -translate-y-1/2 items-center border-r border-gray-200 pl-3 pr-2.5 text-sm font-semibold tabular-nums text-gray-500 dark:border-white/10"
          >
            {getDialCode(iso2)}
          </span>
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-describedby={dialCodeId}
            disabled={disabled}
            value={formatAsYouType(nationalNumber, iso2)}
            placeholder={placeholder}
            onChange={(event) => {
              // Keep only digits in state; formatting is a view concern. The
              // leading trunk zero is preserved while typing and stripped at
              // validation, so 0803… and 803… both work.
              const digits = event.target.value.replace(/\D/g, '');
              setNationalNumber(digits);
              setTouched(true);
              emit(digits, iso2);
            }}
            onBlur={() => setTouched(true)}
            className="form-field h-12 w-full rounded-2xl pr-4 text-sm"
            style={{
              // Clears the locked dial-code segment and its divider: the
              // span is pl-3 + code + pr-2.5, and the code is not fixed width.
              paddingLeft: `${Math.max(3.5, getDialCode(iso2).length * 0.55 + 1.975)}rem`,
            }}
          />
        </div>
      </div>

      {visibleError ? (
        <p className="text-xs font-medium text-red-500">{visibleError}</p>
      ) : completeness.isValid ? (
        <p className="text-xs font-medium text-green-600">
          ✓ Valid number — saved as {completeness.e164}
        </p>
      ) : helperText ? (
        <p className="text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
};

export default PhoneNumberField;

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
        label: compactCountryLabel
          ? `${country.flag} ${country.iso2}`
          : `${country.flag} ${country.name}`,
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

      <div className="flex items-stretch gap-2 w-full min-w-0">
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
          className="w-[5.75rem] md:w-[11.5rem] shrink-0"
          fitContent={false}
          compact
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
            className="form-field h-12 w-full rounded-lg pr-4 text-sm"
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

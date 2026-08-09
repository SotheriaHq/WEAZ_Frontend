import React, { useEffect, useMemo, useState } from 'react';
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

  const countryOptions = useMemo(
    () =>
      PHONE_COUNTRIES.map((country) => ({
        value: country.iso2,
        label: `${country.flag} +${country.callingCode}`,
        description: country.name,
      })),
    [],
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
          className="w-[5.25rem] sm:w-[6rem] shrink-0"
          fitContent={false}
          compact
        />

        <div className="relative flex-1 min-w-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
            {getDialCode(iso2)}
          </span>
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
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
              paddingLeft: `${Math.max(3.25, getDialCode(iso2).length * 0.65 + 1.9)}rem`,
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

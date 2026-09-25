import React from 'react';
import UniversalSelect, {
  type UniversalSelectOption,
} from '@/components/forms/UniversalSelect';

/**
 * A location cascade field (state / city) that can never dead-end.
 *
 * The cascade's option lists come from a third-party API. Every caller used to
 * render `<UniversalSelect disabled={options.length === 0} />`, which turns any
 * upstream failure into a form the user physically cannot complete: they pick a
 * country, the state field stays greyed out forever, and nothing explains why.
 * That is a hard stop on signup, caused by someone else's uptime.
 *
 * So: show the picker when we have options, and fall back to a plain text input
 * when we do not. A typed value is worth infinitely more than a perfect list the
 * user never gets to see.
 */
interface LocationCascadeSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: UniversalSelectOption[];
  /** Not chosen yet — the field is genuinely not ready. */
  parentValue: string;
  parentPlaceholder: string;
  loading?: boolean;
  disabled?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  /** Shown under the free-text fallback so the switch is not mysterious. */
  fallbackHint: string;
  menuLayer?: 'dropdown' | 'modal';
  className?: string;
}

const LocationCascadeSelect: React.FC<LocationCascadeSelectProps> = ({
  label,
  value,
  onChange,
  options,
  parentValue,
  parentPlaceholder,
  loading = false,
  disabled = false,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  fallbackHint,
  menuLayer = 'modal',
  className = 'w-full',
}) => {
  const hasOptions = options.length > 0;
  const parentChosen = Boolean(parentValue);

  // Only fall back once we know the list is not merely in flight — flipping to
  // a text input mid-load would yank the picker out from under the user.
  const showFreeText = parentChosen && !hasOptions && !loading;

  if (showFreeText) {
    return (
      <div className={className}>
        <label className="mb-1.5 block text-sm font-semibold text-theme-secondary">
          {label}
        </label>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="form-field h-12 w-full rounded-lg px-4"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-gray-500">{fallbackHint}</p>
      </div>
    );
  }

  return (
    <UniversalSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={
        !parentChosen ? parentPlaceholder : loading ? 'Loading…' : placeholder
      }
      searchable
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled || !parentChosen || loading}
      className={className}
      menuLayer={menuLayer}
      optionAllowWrap
      selectedAllowWrap
    />
  );
};

export default LocationCascadeSelect;

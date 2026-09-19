import React, { useEffect, useMemo, useState } from 'react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import UniversalSelect from '@/components/forms/UniversalSelect';
import LocationCascadeSelect from '@/components/forms/LocationCascadeSelect';
import {
  locationService,
  LOCATION_FIELD_LABELS,
  type CountryOption,
  type StateOption,
} from '@/services/LocationService';

/**
 * The shopper's own profile edit.
 *
 * ## Location used to be one text box
 *
 * A single "Location" input with a `City, State, Country` placeholder. Whatever
 * was typed went straight into `UserProfile.address` and came back as the
 * display line, so nothing could read it back — no picker could be populated
 * from it, no field could be corrected without retyping the whole sentence, and
 * two shoppers in the same city could store it three different ways.
 *
 * It is the cascade now, matching the brand editor and the native profile
 * screen: country and state and city are picked, and the street address is its
 * own field. The parts are stored separately; `location` is composed by the
 * server for display, and the street address is deliberately not part of it.
 *
 * ## Why the pickers can never dead-end
 *
 * The option lists come from a third-party API. `LocationCascadeSelect` swaps to
 * a plain text input when a list comes back empty and settled, so an upstream
 * outage costs the shopper a dropdown, not the ability to finish the form.
 */

export interface EndUserQuickEditValues {
  firstName: string;
  lastName: string;
  /** Street address only — the administrative levels are their own fields. */
  address: string;
  country: string;
  state: string;
  /** Same administrative level Nigeria calls a Local Government Area. */
  city: string;
}

interface EndUserQuickEditModalProps {
  open: boolean;
  initialValues: EndUserQuickEditValues;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: EndUserQuickEditValues) => Promise<void>;
}

export const EndUserQuickEditModal: React.FC<EndUserQuickEditModalProps> = ({
  open,
  initialValues,
  saving = false,
  onClose,
  onSave,
}) => {
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [address, setAddress] = useState(initialValues.address);
  const [country, setCountry] = useState(initialValues.country);
  const [state, setState] = useState(initialValues.state);
  const [city, setCity] = useState(initialValues.city);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(initialValues.firstName);
    setLastName(initialValues.lastName);
    setAddress(initialValues.address);
    setCountry(initialValues.country);
    setState(initialValues.state);
    setCity(initialValues.city);
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLocations(true);
    void locationService.getCountries().then((next) => {
      if (cancelled) return;
      setCountries(next);
      setLoadingLocations(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const countryIso2 = useMemo(
    () => countries.find((entry) => entry.name === country)?.iso2,
    [countries, country],
  );

  useEffect(() => {
    if (!open || !country) {
      setStates([]);
      return;
    }
    let cancelled = false;
    setLoadingLocations(true);
    // ISO2 goes through so the bundled fallback can resolve the country even
    // when the remote display name is not one of its known aliases.
    void locationService.getStates(country, countryIso2).then((next) => {
      if (cancelled) return;
      setStates(next);
      setLoadingLocations(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, country, countryIso2]);

  useEffect(() => {
    if (!open || !country || !state) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoadingLocations(true);
    void locationService.getCities(country, state).then((next) => {
      if (cancelled) return;
      setCities(next);
      setLoadingLocations(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, country, state]);

  useEffect(() => {
    if (!open) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  /*
    A stored value always appears in its own list. A profile saved before the
    country list changed — or saved from the free-text fallback — must still
    show what it holds rather than opening blank.
  */
  const withCurrent = (
    options: { value: string; label: string }[],
    current: string,
  ) => {
    const trimmed = current.trim();
    if (!trimmed || options.some((option) => option.value === trimmed)) {
      return options;
    }
    return [{ value: trimmed, label: trimmed }, ...options];
  };

  const countryOptions = useMemo(
    () =>
      withCurrent(
        countries.map((entry) => ({ value: entry.name, label: entry.name })),
        country,
      ),
    [countries, country],
  );
  const stateOptions = useMemo(
    () =>
      withCurrent(
        states.map((entry) => ({ value: entry.name, label: entry.name })),
        state,
      ),
    [states, state],
  );
  const cityOptions = useMemo(
    () =>
      withCurrent(
        cities.map((entry) => ({ value: entry, label: entry })),
        city,
      ),
    [cities, city],
  );

  if (!open) return null;

  const canSubmit = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  return (
    <OverlayPortal>
      <>
        <div className="fixed inset-0 z-layer-overlay bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit || saving) return;
              void onSave({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                address: address.trim(),
                country: country.trim(),
                state: state.trim(),
                city: city.trim(),
              });
            }}
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl neu-modal-surface shadow-xl p-5"
          >
            <h3 className="text-base font-semibold text-[color:var(--neu-text)]">Quick Profile Edit</h3>
            <p className="mt-1 text-xs neu-text-muted">
              Update your basic profile details without leaving this page.
            </p>

            {/* The form grew from three fields to six, so the body scrolls
                inside the dialog rather than pushing the actions off a short
                viewport. */}
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <label className="block">
                <span className="block text-xs font-medium neu-text-muted mb-1">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                  required
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium neu-text-muted mb-1">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                  required
                />
              </label>

              {/* Choosing a country invalidates the state, and a state
                  invalidates the city — clearing them is what keeps
                  "Lagos, Ghana" impossible rather than merely unlikely. */}
              <UniversalSelect
                label={LOCATION_FIELD_LABELS.country}
                value={country}
                onChange={(next) => {
                  setCountry(next);
                  setState('');
                  setCity('');
                }}
                options={countryOptions}
                placeholder={loadingLocations && countries.length === 0 ? 'Loading…' : 'Select country'}
                searchable
                searchPlaceholder="Search countries…"
                emptyMessage="No matching country found"
                menuLayer="modal"
                className="w-full"
                optionAllowWrap
                selectedAllowWrap
              />

              <LocationCascadeSelect
                label={LOCATION_FIELD_LABELS.state}
                value={state}
                onChange={(next) => {
                  setState(next);
                  setCity('');
                }}
                options={stateOptions}
                parentValue={country}
                parentPlaceholder="Select country first"
                loading={loadingLocations}
                placeholder="Select state / province"
                searchPlaceholder="Search states or provinces…"
                emptyMessage="No matching state or province found"
                fallbackHint="We couldn't load the list for this country — type your state or province."
                menuLayer="modal"
              />

              <LocationCascadeSelect
                label={LOCATION_FIELD_LABELS.city}
                value={city}
                onChange={setCity}
                options={cityOptions}
                parentValue={state}
                parentPlaceholder="Select state first"
                loading={loadingLocations}
                placeholder="Select city / LGA"
                searchPlaceholder="Search cities or LGAs…"
                emptyMessage="No matching city or LGA found"
                fallbackHint="We couldn't load the list for this state — type your city or LGA."
                menuLayer="modal"
              />

              <label className="block">
                <span className="block text-xs font-medium neu-text-muted mb-1">
                  Street address <span className="font-normal">(optional)</span>
                </span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House number and street"
                  autoComplete="street-address"
                  className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                />
                <span className="mt-1 block text-[11px] neu-text-muted">
                  Only you can see this. Hidden entirely when “Show my location” is off in Settings.
                </span>
              </label>
            </div>

            <div className="mt-5 flex shrink-0 items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg neu-modal-inset px-3 py-2 text-xs font-medium text-[color:var(--neu-text)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </>
    </OverlayPortal>
  );
};

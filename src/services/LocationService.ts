import { apiClient } from '@/api/httpClient';
import { getOfflineRegions } from '@/data/countryRegions';
import { getCitiesForState } from '@/data/locations';
import { getCountryFlagEmoji } from '@/components/ui/CountryFlag';

export { getCountryFlagEmoji };

/**
 * Location cascade source for profile/settings forms.
 * Country (name) → State/Province → City/LGA.
 * Keep in parity with `threadly-mobile/src/services/locationService.ts`.
 *
 * Everything comes from the WIEZ API (`/locations/*`). The browser used to call
 * restcountries.com, countriesnow.space and flagcdn.com directly, which showed
 * every visitor's IP address to them. Flags are the self-hosted `/flags/` set.
 */

// Interfaces
export interface CountryOption {
    name: string;
    iso2: string; // Used for flags and API calls
    flag: string; // Emoji / alt
    flagImage: string; // Self-hosted SVG path
}

export interface StateOption {
    name: string;
    iso2: string;
}

export interface CityOption {
    name: string;
}

/** Shared field labels for profile location cascade (anti-truncation-friendly). */
export const LOCATION_FIELD_LABELS = {
    country: 'Country',
    state: 'State / Province',
    city: 'City / LGA',
} as const;

const LOCATION_REQUEST_TIMEOUT_MS = 2500;

const toCountryOption = (iso2: string, name: string): CountryOption => ({
    name,
    iso2,
    flag: getCountryFlagEmoji(iso2),
    flagImage: `/flags/${iso2.toLowerCase()}.svg`,
});

/** Platform operating markets when the country list is unavailable. */
export const FALLBACK_COUNTRIES: CountryOption[] = [
    toCountryOption('GH', 'Ghana'),
    toCountryOption('KE', 'Kenya'),
    toCountryOption('NG', 'Nigeria'),
    toCountryOption('ZA', 'South Africa'),
    toCountryOption('GB', 'United Kingdom'),
    toCountryOption('US', 'United States'),
];

const listFrom = <T,>(response: unknown): T[] => {
    const body = response as { data?: { data?: unknown } | unknown } | undefined;
    const payload = (body?.data as { data?: unknown } | undefined)?.data ?? body?.data;
    return Array.isArray(payload) ? (payload as T[]) : [];
};

class LocationService {
    // Cache
    private countriesCache: CountryOption[] | null = null;
    private statesCache: Record<string, StateOption[]> = {};
    private citiesCache: Record<string, string[]> = {};

    /** All countries, sorted by name. */
    async getCountries(): Promise<CountryOption[]> {
        if (this.countriesCache) return this.countriesCache;

        try {
            const response = await apiClient.get('/locations/countries', {
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });
            const countries = listFrom<{ iso2?: unknown; name?: unknown }>(response)
                .filter((c): c is { iso2: string; name: string } =>
                    typeof c?.iso2 === 'string' && typeof c?.name === 'string')
                .map((c) => toCountryOption(c.iso2, c.name));
            this.countriesCache = countries.length > 0 ? countries : FALLBACK_COUNTRIES;
        } catch {
            this.countriesCache = FALLBACK_COUNTRIES;
        }
        return this.countriesCache;
    }

    /**
     * States for a country (by ISO code when known, else name).
     *
     * Falls back to bundled data rather than an empty list. An empty list is
     * rendered as a DISABLED dropdown by every caller, so returning `[]` on a
     * network failure silently strands the user on a form they cannot finish.
     */
    async getStates(countryName: string, iso2?: string): Promise<StateOption[]> {
        if (!countryName) return [];
        if (this.statesCache[countryName]) return this.statesCache[countryName];

        try {
            const response = await apiClient.get('/locations/states', {
                params: { country: iso2 || countryName },
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });
            const states = listFrom<unknown>(response)
                .filter((name): name is string => typeof name === 'string')
                .map((name) => ({ name, iso2: '' }));
            if (states.length > 0) {
                this.statesCache[countryName] = states;
                return states;
            }
        } catch {
            // Bundled regions below.
        }

        const offline = getOfflineRegions(countryName, iso2).map((name) => ({
            name,
            iso2: '',
        }));
        if (offline.length > 0) {
            // Cached so a flaky connection does not re-await the timeout on
            // every keystroke that re-runs the cascade.
            this.statesCache[countryName] = offline;
        }
        return offline;
    }

    /**
     * Cities/LGAs for a country and state.
     * Bundled offline data (e.g. Nigeria's 774 LGAs) is checked first for 0ms offline readiness.
     * Remote calls have a responsive timeout and automatic retry before falling back to manual entry.
     */
    async getCities(countryName: string, stateName: string): Promise<string[]> {
        if (!countryName || !stateName) return [];
        const key = `${countryName}-${stateName}`;
        if (this.citiesCache[key]) return this.citiesCache[key];

        // 1. Instant bundled offline check (covers Nigeria's LGAs + major hubs)
        const offlineCities = getCitiesForState(countryName, stateName);
        if (offlineCities && offlineCities.length > 0) {
            this.citiesCache[key] = offlineCities;
            return offlineCities;
        }

        // 2. Fetch with responsive timeout and 1 automatic retry
        const fetchRemote = async (): Promise<string[]> => {
            const response = await apiClient.get('/locations/cities', {
                params: { country: countryName, state: stateName },
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });
            return listFrom<unknown>(response).filter(
                (name): name is string => typeof name === 'string',
            );
        };

        try {
            const cities = await fetchRemote();
            if (cities.length > 0) {
                this.citiesCache[key] = cities;
                return cities;
            }
        } catch {
            // Retry once after brief backoff
            try {
                await new Promise((resolve) => setTimeout(resolve, 500));
                const retryCities = await fetchRemote();
                if (retryCities.length > 0) {
                    this.citiesCache[key] = retryCities;
                    return retryCities;
                }
            } catch {
                // Return empty so caller can offer free-text entry gracefully
            }
        }

        return [];
    }
}

export const locationService = new LocationService();

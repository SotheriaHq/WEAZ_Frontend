import axios from 'axios';
import { getOfflineRegions } from '@/data/countryRegions';

/**
 * Location cascade source for profile/settings forms.
 * Country (name) → State/Province → City/LGA.
 * Keep in parity with `wiez-mobile/src/services/locationService.ts`.
 */

// Interfaces
export interface CountryOption {
    name: string;
    iso2: string; // Used for flags and API calls
    flag: string; // Emoji / alt
    flagImage: string; // SVG Url
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

// APIs
const COUNTRIES_API = 'https://countriesnow.space/api/v0.1/countries';
const REST_COUNTRIES_API = 'https://restcountries.com/v3.1/all?fields=name,cca2,flags';
const LOCATION_REQUEST_TIMEOUT_MS = 8000;

/** Platform operating markets when the live country list is unavailable. */
export const FALLBACK_COUNTRIES: CountryOption[] = [
    { name: 'Ghana', iso2: 'GH', flag: '', flagImage: 'https://flagcdn.com/gh.svg' },
    { name: 'Kenya', iso2: 'KE', flag: '', flagImage: 'https://flagcdn.com/ke.svg' },
    { name: 'Nigeria', iso2: 'NG', flag: '', flagImage: 'https://flagcdn.com/ng.svg' },
    { name: 'South Africa', iso2: 'ZA', flag: '', flagImage: 'https://flagcdn.com/za.svg' },
    { name: 'United Kingdom', iso2: 'GB', flag: '', flagImage: 'https://flagcdn.com/gb.svg' },
    { name: 'United States', iso2: 'US', flag: '', flagImage: 'https://flagcdn.com/us.svg' },
];

class LocationService {
    // Cache
    private countriesCache: CountryOption[] | null = null;
    private statesCache: Record<string, StateOption[]> = {};
    private citiesCache: Record<string, string[]> = {};

    /**
     * Fetch all countries with flags.
     * Prefer restcountries for flags + iso2, merge with countriesnow if needed, 
     * but restcountries is usually sufficient for the country list.
     */
    async getCountries(): Promise<CountryOption[]> {
        if (this.countriesCache) return this.countriesCache;

        try {
            // Using RestCountries for the best flag data
            const response = await axios.get(REST_COUNTRIES_API, {
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });
            // Sort by common names
            const sorted = response.data.sort((a: any, b: any) =>
                a.name.common.localeCompare(b.name.common)
            );

            this.countriesCache = sorted.map((c: any) => ({
                name: c.name.common,
                iso2: c.cca2,
                flag: c.flags.alt || '', // Description or emoji? Restcountries puts Emoji in .flag sometimes, but let's use svg
                flagImage: c.flags.svg
            }));

            return this.countriesCache || [];
        } catch (error) {
            console.error("Failed to fetch countries:", error);
            this.countriesCache = FALLBACK_COUNTRIES;
            return this.countriesCache;
        }
    }

    /**
     * Fetch states for a given country (by Name, optionally with ISO2).
     *
     * Falls back to bundled data rather than an empty list. An empty list is
     * rendered as a DISABLED dropdown by every caller, so returning `[]` on a
     * network failure silently strands the user on a form they cannot finish —
     * which is exactly what happened when the upstream endpoint moved.
     */
    async getStates(countryName: string, iso2?: string): Promise<StateOption[]> {
        if (!countryName) return [];
        if (this.statesCache[countryName]) return this.statesCache[countryName];

        try {
            // GET .../states/q?country=Nigeria — NOT the old POST .../states.
            //
            // The POST form now answers `301 → /states/q?country=…`. A browser
            // cannot follow that: the JSON content type makes the request
            // preflighted, and a redirect on a preflighted request is a hard
            // CORS failure. It also took ~13s to answer, past the 8s timeout
            // below. So in a real browser this call failed 100% of the time and
            // every user saw a dead state dropdown.
            const response = await axios.get(`${COUNTRIES_API}/states/q`, {
                params: { country: countryName },
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });

            const remoteStates = response.data?.error
                ? []
                : (response.data?.data?.states ?? []);
            if (Array.isArray(remoteStates) && remoteStates.length > 0) {
                const states = remoteStates.map((s: any) => ({
                    name: s.name,
                    iso2: s.state_code,
                }));
                this.statesCache[countryName] = states;
                return states;
            }
        } catch (error) {
            console.warn(`Failed to fetch states for ${countryName}:`, error);
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
     * Fetch cities for a given country and state. Cities have no bundled
     * fallback — callers must accept a typed value when this comes back empty.
     */
    async getCities(countryName: string, stateName: string): Promise<string[]> {
        if (!countryName || !stateName) return [];
        const key = `${countryName}-${stateName}`;
        if (this.citiesCache[key]) return this.citiesCache[key];

        try {
            const response = await axios.get(`${COUNTRIES_API}/state/cities/q`, {
                params: { country: countryName, state: stateName },
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });

            if (response.data && !response.data.error) {
                const cities = Array.isArray(response.data.data)
                    ? response.data.data
                    : [];
                this.citiesCache[key] = cities;
                return cities;
            }
            return [];
        } catch (error) {
            console.warn(`Failed to fetch cities for ${countryName}/${stateName}:`, error);
            return [];
        }
    }
}

export const locationService = new LocationService();

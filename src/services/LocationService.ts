
import axios from 'axios';

// Interfaces
export interface CountryOption {
    name: string;
    iso2: string; // Used for flags and API calls
    flag: string; // Emoji
    flagImage: string; // SVG Url
}

export interface StateOption {
    name: string;
    iso2: string;
}

export interface CityOption {
    name: string;
}

// APIs
const COUNTRIES_API = 'https://countriesnow.space/api/v0.1/countries';
const REST_COUNTRIES_API = 'https://restcountries.com/v3.1/all?fields=name,cca2,flags';
const LOCATION_REQUEST_TIMEOUT_MS = 8000;
const FALLBACK_COUNTRIES: CountryOption[] = [
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
     * Fetch states for a given country (by Name or ISO2).
     * CountriesNow uses country name ("Nigeria") for its main endpoints.
     */
    async getStates(countryName: string): Promise<StateOption[]> {
        if (!countryName) return [];
        if (this.statesCache[countryName]) return this.statesCache[countryName];

        try {
            // CountriesNow requires POST with { country: "Nigeria" }
            const response = await axios.post(`${COUNTRIES_API}/states`, {
                country: countryName
            }, {
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });

            if (response.data && !response.data.error) {
                const states = response.data.data.states.map((s: any) => ({
                    name: s.name,
                    iso2: s.state_code
                }));
                this.statesCache[countryName] = states;
                return states;
            }
            return [];
        } catch (error) {
            console.warn(`Failed to fetch states for ${countryName}:`, error);
            return [];
        }
    }

    /**
     * Fetch cities for a given country and state.
     */
    async getCities(countryName: string, stateName: string): Promise<string[]> {
        if (!countryName || !stateName) return [];
        const key = `${countryName}-${stateName}`;
        if (this.citiesCache[key]) return this.citiesCache[key];

        try {
            const response = await axios.post(`${COUNTRIES_API}/state/cities`, {
                country: countryName,
                state: stateName
            }, {
                timeout: LOCATION_REQUEST_TIMEOUT_MS,
            });

            if (response.data && !response.data.error) {
                const cities = response.data.data;
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

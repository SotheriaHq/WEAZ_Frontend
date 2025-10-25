export interface LocationStateOption {
  name: string;
  cities: string[];
}

export interface LocationCountryOption {
  name: string;
  states: LocationStateOption[];
}

export const DEFAULT_COUNTRY = 'Nigeria';

export const LOCATION_DATA: LocationCountryOption[] = [
  {
    name: 'Nigeria',
    states: [
      {
        name: 'Lagos',
        cities: ['Ikeja', 'Victoria Island', 'Lekki', 'Yaba', 'Surulere'],
      },
      {
        name: 'Abuja FCT',
        cities: ['Central Business District', 'Garki', 'Wuse', 'Maitama', 'Asokoro'],
      },
      {
        name: 'Rivers',
        cities: ['Port Harcourt', 'Bonny Island', 'Omoku', 'Eleme'],
      },
      {
        name: 'Kano',
        cities: ['Kano', 'Bichi', 'Gaya', 'Rano'],
      },
      {
        name: 'Oyo',
        cities: ['Ibadan', 'Ogbomoso', 'Oyo Town', 'Iseyin'],
      },
    ],
  },
  {
    name: 'Ghana',
    states: [
      {
        name: 'Greater Accra',
        cities: ['Accra', 'Tema', 'Madina', 'Ashaiman'],
      },
      {
        name: 'Ashanti',
        cities: ['Kumasi', 'Obuasi', 'Ejisu'],
      },
    ],
  },
];

export const getStatesForCountry = (country?: string): LocationStateOption[] => {
  if (!country) {
    return [];
  }

  const countryData = LOCATION_DATA.find(
    (entry) => entry.name.toLowerCase() === country.toLowerCase(),
  );
  return countryData ? countryData.states : [];
};

export const getCitiesForState = (
  country?: string,
  state?: string,
): string[] => {
  if (!country || !state) {
    return [];
  }

  const states = getStatesForCountry(country);
  const stateData = states.find(
    (entry) => entry.name.toLowerCase() === state.toLowerCase(),
  );
  return stateData ? stateData.cities : [];
};

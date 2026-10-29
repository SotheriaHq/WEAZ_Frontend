import { describe, expect, it } from 'vitest';
import { NIGERIA_LGAS, getNigeriaLgasForState } from './nigeriaLgas';
import { getCitiesForState } from './locations';

describe('nigeriaLgas data & cascade', () => {
  it('covers all 36 states plus Federal Capital Territory', () => {
    const states = Object.keys(NIGERIA_LGAS);
    expect(states.length).toBeGreaterThanOrEqual(37);
    expect(NIGERIA_LGAS['Lagos']).toContain('Ikeja');
    expect(NIGERIA_LGAS['Lagos']).toContain('Alimosho');
    expect(NIGERIA_LGAS['Abia']).toContain('Aba North');
    expect(NIGERIA_LGAS['Abia']).toContain('Umuahia North');
  });

  it('retrieves LGAs case-insensitively and maps Abuja/FCT', () => {
    expect(getNigeriaLgasForState('abia')).toContain('Aba North');
    expect(getNigeriaLgasForState('LAGOS')).toContain('Ikeja');
    expect(getNigeriaLgasForState('Abuja FCT')).toContain('Municipal Area Council (AMAC)');
  });

  it('getCitiesForState returns offline LGAs instantly for Nigeria', () => {
    const abiaLgas = getCitiesForState('Nigeria', 'Abia');
    expect(abiaLgas.length).toBeGreaterThan(0);
    expect(abiaLgas).toContain('Arochukwu');
  });
});

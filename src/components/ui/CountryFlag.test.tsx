import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CountryFlag, getCountryFlagEmoji } from './CountryFlag';

describe('CountryFlag', () => {
  it('converts 2-letter ISO codes to standard country flag emoji', () => {
    expect(getCountryFlagEmoji('NG')).toBe('🇳🇬');
    expect(getCountryFlagEmoji('gh')).toBe('🇬🇭');
    expect(getCountryFlagEmoji('KE')).toBe('🇰🇪');
    expect(getCountryFlagEmoji('za')).toBe('🇿🇦');
    expect(getCountryFlagEmoji('GB')).toBe('🇬🇧');
    expect(getCountryFlagEmoji('US')).toBe('🇺🇸');
  });

  it('renders an inline image with aria-hidden to avoid double announcement', () => {
    const { container } = render(
      <CountryFlag iso2="NG" name="Nigeria" flagImage="https://flagcdn.com/ng.svg" />
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://flagcdn.com/ng.svg');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('falls back to emoji cleanly when flag image triggers error', () => {
    const { container } = render(
      <CountryFlag iso2="NG" name="Nigeria" />
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) {
      fireEvent.error(img);
    }
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('🇳🇬');
  });
});

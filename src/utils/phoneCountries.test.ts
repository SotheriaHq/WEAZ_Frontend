import { describe, expect, it } from 'vitest';
import {
  checkPhoneCompleteness,
  getDialCode,
  getPhoneCountry,
  PHONE_COUNTRIES,
  splitE164,
} from './phoneCountries';

describe('phoneCountries', () => {
  it('lists the operating markets first with their dial codes', () => {
    expect(PHONE_COUNTRIES.slice(0, 6).map((c) => c.iso2)).toEqual([
      'NG',
      'GH',
      'KE',
      'ZA',
      'GB',
      'US',
    ]);
    expect(getDialCode('NG')).toBe('+234');
    expect(getDialCode('GH')).toBe('+233');
    expect(getPhoneCountry('NG')?.name).toBe('Nigeria');
  });

  describe('checkPhoneCompleteness', () => {
    it('accepts a Nigerian number typed with its local trunk zero', () => {
      // This is the case that drove the change: a Nigerian number is printed
      // as 11 digits starting 0, but +2340803… is not a real number. Users type
      // what is on their SIM pack, so the zero has to be absorbed, not rejected.
      const result = checkPhoneCompleteness('08031234567', 'NG');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+2348031234567');
    });

    it('accepts the same number without the trunk zero', () => {
      const result = checkPhoneCompleteness('8031234567', 'NG');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+2348031234567');
    });

    it('rejects an incomplete number and says how many digits are missing', () => {
      const result = checkPhoneCompleteness('0803123', 'NG');
      expect(result.isValid).toBe(false);
      expect(result.e164).toBeNull();
      expect(result.error).toMatch(/Too short for Nigeria/);
      expect(result.error).toMatch(/\+234/);
    });

    it('rejects an over-long number', () => {
      const result = checkPhoneCompleteness('080312345678901', 'NG');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Too long for Nigeria/);
    });

    it('validates against the SELECTED country, not a global default', () => {
      // A valid Nigerian national number is not a valid Ghanaian one. Before
      // this, every field validated against a hardcoded NG default, so a
      // Ghanaian user could not enter their own number.
      expect(checkPhoneCompleteness('0244123456', 'GH').isValid).toBe(true);
      expect(checkPhoneCompleteness('8031234567', 'GH').isValid).toBe(false);
    });

    // Per-country matrix across the operating markets. Real national formats:
    //   NG 10-digit NSN, mobile prefixes 070/080/081/090/091 (NCC plan)
    //   GH 9-digit NSN, mobile 020/024/054/055/059…
    //   KE 9-digit NSN, mobile 7xx / 1xx
    //   ZA 9-digit NSN, mobile 06x/07x/08x
    //   GB 10-digit mobile NSN, 74xx–79xx
    //   US 10-digit NANP, area code cannot start with 0 or 1
    it.each([
      ['NG', '08031234567', true],
      ['NG', '07051234567', true],
      ['NG', '09012345678', true],
      ['NG', '0503123456', false], // 050 is not an allocated NG mobile prefix
      ['GH', '0244123456', true],
      ['GH', '0201234567', true],
      ['GH', '02012345678', false], // one digit too many for Ghana's 9-digit NSN
      ['GH', '024412345', false], // one digit short
      ['KE', '0712345678', true],
      ['KE', '071234567', false], // one digit short
      ['ZA', '0821234567', true],
      ['GB', '07400123456', true],
      ['GB', '0740012345', false], // one digit short
      ['US', '2125551234', true],
      ['US', '0125551234', false], // NANP area codes cannot start with 0
    ])('validates %s number %s as %s', (iso2, input, expected) => {
      expect(checkPhoneCompleteness(input, iso2 as never).isValid).toBe(
        expected,
      );
    });

    it('rejects digit patterns that are merely the right LENGTH', () => {
      // This is what the default (min) metadata bundle could not do. It checks
      // length only, so a same-length number with an unallocated prefix passed.
      // Both of these are 10 NG digits; only the first is a real prefix.
      expect(checkPhoneCompleteness('8031234567', 'NG').isValid).toBe(true);
      expect(checkPhoneCompleteness('1231234567', 'NG').isValid).toBe(false);
    });

    it('treats empty input as empty rather than invalid', () => {
      const result = checkPhoneCompleteness('', 'NG');
      expect(result.isEmpty).toBe(true);
      expect(result.error).toBeNull();
    });

    it('ignores spaces and punctuation the user types', () => {
      expect(checkPhoneCompleteness('0803 123 4567', 'NG').e164).toBe(
        '+2348031234567',
      );
      expect(checkPhoneCompleteness('(0803) 123-4567', 'NG').e164).toBe(
        '+2348031234567',
      );
    });
  });

  describe('splitE164', () => {
    it('round-trips a stored number back into country + national parts', () => {
      expect(splitE164('+2348031234567')).toEqual({
        iso2: 'NG',
        nationalNumber: '8031234567',
      });
      expect(splitE164('+233244123456')).toEqual({
        iso2: 'GH',
        nationalNumber: '244123456',
      });
    });

    it('falls back to the default country for an empty or unparseable value', () => {
      expect(splitE164('')).toEqual({ iso2: 'NG', nationalNumber: '' });
      expect(splitE164(null)).toEqual({ iso2: 'NG', nationalNumber: '' });
    });
  });
});

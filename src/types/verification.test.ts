import { describe, expect, it } from 'vitest';
import {
  verificationInfoItemLabel,
  verificationInfoItemMessage,
} from './verification';

/**
 * Requested items are `{ field, label, message? }` objects. The request-history
 * panel rendered them straight into JSX and printed "[object Object]" where the
 * reviewer's requested fields should have been.
 */
describe('verificationInfoItemLabel', () => {
  it('reads the label off an item object', () => {
    expect(
      verificationInfoItemLabel({ field: 'cacNumber', label: 'CAC number' }),
    ).toBe('CAC number');
  });

  it('falls back to the field name when no label was stored', () => {
    expect(
      verificationInfoItemLabel({ field: 'cacCertificateKey', label: '' }),
    ).toBe('cacCertificateKey');
  });

  it('still renders bare-string rows already in the audit log', () => {
    // The trail is retroactive, so it can contain rows written before the
    // object shape settled. Never let one of those print as "[object Object]".
    expect(verificationInfoItemLabel('CAC_CERTIFICATE')).toBe('CAC CERTIFICATE');
  });

  it('never returns the literal "[object Object]"', () => {
    const samples: Array<Parameters<typeof verificationInfoItemLabel>[0]> = [
      { field: 'ownerNin', label: 'Owner NIN' },
      { field: 'x', label: '' },
      'ID_FRONT',
    ];
    for (const sample of samples) {
      expect(verificationInfoItemLabel(sample)).not.toContain('object Object');
    }
  });
});

describe('verificationInfoItemMessage', () => {
  it('surfaces a per-item reviewer note', () => {
    expect(
      verificationInfoItemMessage({
        field: 'cacCertificateKey',
        label: 'CAC certificate',
        message: '  Blurry scan  ',
      }),
    ).toBe('Blurry scan');
  });

  it('treats blank and string rows as no note', () => {
    expect(
      verificationInfoItemMessage({ field: 'a', label: 'A', message: '   ' }),
    ).toBeNull();
    expect(verificationInfoItemMessage('CAC_CERTIFICATE')).toBeNull();
  });
});

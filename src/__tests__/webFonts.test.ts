import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('self-hosted production fonts', () => {
  it('ships the original complete WOFF2 payloads, licenses and subsets', () => {
    const root = resolve(process.cwd(), 'public/fonts/wiez-web');
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    const css = readFileSync(resolve(process.cwd(), 'src/styles/web-fonts.css'), 'utf8');
    expect(manifest.faces).toBe(28);
    expect(manifest.files).toHaveLength(8);
    expect(css.match(/@font-face/g)).toHaveLength(28);
    expect(css).not.toContain('url(https:');
    // Extended Latin retains accented African names and the NGN currency sign.
    expect(css).toContain('U+20A0-20AB');
    for (const file of manifest.files) {
      const bytes = readFileSync(resolve(root, file.name));
      expect(bytes.toString('ascii', 0, 4)).toBe('wOF2');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      expect(bytes.length).toBe(file.bytes);
      expect(css).toContain(`/fonts/wiez-web/${file.name}`);
    }
    for (const name of ['playfair-display-OFL.txt', 'plus-jakarta-sans-OFL.txt']) {
      expect(readFileSync(resolve(root, name), 'utf8')).toContain('SIL OPEN FONT LICENSE');
    }
    expect(readFileSync(resolve(root, 'playfair-display-FONTLOG.txt'), 'utf8')).toContain('Playfair');
  });

  it('preloads the body font without a render-blocking third-party stylesheet', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).toContain('as="font"');
    expect(html).toContain('crossorigin');
    expect(html).toContain('plus-jakarta-sans-latin-153fc85b7029.woff2');
  });
});

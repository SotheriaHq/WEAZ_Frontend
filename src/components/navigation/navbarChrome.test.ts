import { describe, expect, it } from 'vitest';

import {
  IMMERSIVE_NAV_HEIGHT_PX,
  RUNWAY_CHIPS_HEIGHT_PX,
  RUNWAY_CHROME_HEIGHT_PX,
  RUNWAY_STAGE_CHROME_HEIGHT_PX,
  isRunwayStagePath,
} from './navbarChrome';

describe('isRunwayStagePath', () => {
  it.each(['/', '/runway'])('claims %s', (pathname) => {
    expect(isRunwayStagePath(pathname)).toBe(true);
  });

  it.each(['/market', '/profile', '/runway/123', '/runways', '/studio'])(
    'leaves %s alone',
    (pathname) => {
      // A nested route is a different screen and keeps the bar; matching by
      // prefix here would strip navigation from pages that need it.
      expect(isRunwayStagePath(pathname)).toBe(false);
    },
  );
});

describe('stage chrome', () => {
  it('costs only the chip row', () => {
    expect(RUNWAY_STAGE_CHROME_HEIGHT_PX).toBe(RUNWAY_CHIPS_HEIGHT_PX);
  });

  it('reclaims the whole bar from the old layout', () => {
    expect(RUNWAY_CHROME_HEIGHT_PX - RUNWAY_STAGE_CHROME_HEIGHT_PX).toBe(
      IMMERSIVE_NAV_HEIGHT_PX,
    );
  });

  it('gives a phone viewport back a meaningful share of its height', () => {
    // The reported complaint was the screen "looking short". 108px of a ~640px
    // viewport is a sixth of the stage; this pins that the saving is real.
    const PHONE_VIEWPORT_PX = 640;
    const reclaimedShare =
      (RUNWAY_CHROME_HEIGHT_PX - RUNWAY_STAGE_CHROME_HEIGHT_PX) / PHONE_VIEWPORT_PX;
    expect(reclaimedShare).toBeGreaterThan(0.09);
  });
});

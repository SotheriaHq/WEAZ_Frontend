import { describe, expect, it } from 'vitest';

import { brandVisitHeadline } from './visitPresentation';

/*
 * Free brands may verify by live video call (owner, Nov 2026). The brand's
 * panel must say "video call" — and what to show on it — once that is the
 * mode, and read exactly as before for a visit.
 */
describe('brandVisitHeadline', () => {
  it('reads as a visit by default', () => {
    expect(brandVisitHeadline('SCHEDULE_CONFIRMED').title).toBe(
      'Your visit is scheduled',
    );
    expect(brandVisitHeadline('SCHEDULE_PROPOSED', 'IN_PERSON').title).toBe(
      'Choose a time for your visit',
    );
  });

  it('reads as a video call, and says what to show', () => {
    const scheduled = brandVisitHeadline('SCHEDULE_CONFIRMED', 'VIDEO_CALL');
    expect(scheduled.title).toBe('Your video call is scheduled');
    expect(scheduled.body).toContain('workstation');
    expect(scheduled.body).toContain('screenshots');
    expect(brandVisitHeadline('ASSIGNED', 'VIDEO_CALL').title).toBe(
      'Your video call is being arranged',
    );
  });

  it('keeps the verdict wording for both modes', () => {
    expect(brandVisitHeadline('PASSED', 'VIDEO_CALL')).toEqual(
      brandVisitHeadline('PASSED', 'IN_PERSON'),
    );
  });
});

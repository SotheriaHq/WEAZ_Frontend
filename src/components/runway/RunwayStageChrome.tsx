import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from '@/store';
import { toggleSidebar } from '@/features/uiSlice';
import BrandWordmark from '@/components/brand/BrandWordmark';
import CountBadge from '@/components/navigation/CountBadge';
import { RUNWAY_CHIPS_HEIGHT_PX } from '@/components/navigation/navbarChrome';

/**
 * The only chrome on the phone Runway besides the category chips.
 *
 * ## Why there is anything here at all
 *
 * The previous shape removed the top bar outright. That fixed the height
 * problem — a 64px bar plus a 44px chip row was a sixth of a ~640px viewport
 * spent on chrome a browsing reader is not using — but it left a real hole:
 * search and notifications became unreachable from this one route. This is the
 * hole, closed, without giving the height back.
 *
 * ## Why it costs no height
 *
 * The old bar had a SOLID band and pushed the stage down by its own height.
 * This floats over the media on a gradient scrim, so the photograph still
 * starts at pixel zero and nothing is displaced. That is the whole difference
 * between this and the treatment that was rejected twice: not transparency
 * versus opacity, but five controls over a model's face versus two at the
 * edges, on a scrim, with the centre of the frame — where a subject's face
 * actually is — left completely clear.
 *
 * ## One pill, not two objects
 *
 * The menu glyph and the wordmark share a single frosted surface. Two floating
 * objects a few pixels apart read as two decisions; one pill reads as a
 * brand-and-navigation unit, which is what it is. It also gives the unread
 * badge a clean outer corner to sit on instead of wedging it between the glyph
 * and the letters.
 *
 * The wordmark is deliberately NOT a link here. Everywhere else it goes to
 * `/`, but on this route `/` IS the Runway — so as a link it is a tap that
 * does nothing, and a dead tap target over a photograph is worse than no
 * target. It is identity, and the glyph beside it is the control.
 *
 * There is no "· RUNWAY" label either. The island bar at the bottom already
 * shows Runway is the active destination; repeating it here is a second answer
 * to a question the reader has not asked, laid over the image.
 *
 * ## The badge counts notifications and nothing else
 *
 * This is load-bearing, not a detail. The bell is gone, so this badge is the
 * only resting-state signal that something is waiting — and it has to be on the
 * CLOSED control, because a count you only see after opening a drawer is not a
 * count. Messages keep their own badge on the island Inbox. If this ever
 * became "notifications + messages" it would tell the reader something is
 * unread without telling them where, and a count you cannot act on without
 * hunting is the same failure wearing a different hat.
 */

/** Height of the control row. The chips sit directly under it. */
export const RUNWAY_STAGE_CONTROLS_HEIGHT_PX = 48;

/**
 * The chip row's height, taken from the module that owns it.
 *
 * This component draws the scrim that has to cover BOTH rows, so it needs the
 * chip height — but as an import, never a copy. A second literal here would
 * drift the moment the chips change, and the failure is silent: a scrim one
 * size too short leaves the chips sitting on bare photograph.
 */
const RUNWAY_STAGE_CHIPS_HEIGHT_PX = RUNWAY_CHIPS_HEIGHT_PX;

/**
 * Blur alone does not survive a bright photograph.
 *
 * `backdrop-blur` over a pastel trench coat on a sunlit street yields a bright
 * panel, and white glyphs on it are unreadable — this is exactly how the
 * earlier transparent bar failed. Apple's version of this effect is not blur;
 * it is blur plus a luminance adjustment that guarantees the panel darkens
 * over bright content, and CSS gives us the blur but not the guarantee.
 *
 * So every glass surface here is blur PLUS a tint floor PLUS a hairline
 * border. The tint is what makes it legible over white; the border is what
 * keeps its edge visible over black.
 */
const GLASS_SURFACE =
  'bg-black/35 backdrop-blur-md border border-white/15 shadow-[0_2px_12px_rgba(0,0,0,0.35)]';

const RunwayStageChrome: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const unreadCount = useSelector(
    (state: RootState) => state.notifications.unreadCount,
  );

  return (
    <>
      {/*
        One scrim for both rows, not one each.

        The controls and the chips are separate fixed layers, and giving each
        its own gradient stacks two fades over the same photograph — a visible
        seam across the top of the feed. This single layer covers both and
        fades out below them, so the chrome sits in one continuous darkening
        rather than two bands.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-20 sm:hidden"
        style={{
          height: `calc(env(safe-area-inset-top, 0px) + ${
            RUNWAY_STAGE_CONTROLS_HEIGHT_PX + RUNWAY_STAGE_CHIPS_HEIGHT_PX + 36
          }px)`,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.42) 55%, rgba(0,0,0,0) 100%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-x-0 z-30 flex items-center justify-between px-3 sm:hidden"
        style={{
          top: 'env(safe-area-inset-top, 0px)',
          height: `${RUNWAY_STAGE_CONTROLS_HEIGHT_PX}px`,
        }}
      >
      {/* One surface: the control and the identity it belongs to. */}
      <div className={`pointer-events-auto relative rounded-full ${GLASS_SURFACE}`}>
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          className="flex h-10 items-center gap-2 rounded-full pl-3 pr-3.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label={
            unreadCount > 0
              ? `Open menu, ${unreadCount} unread notifications`
              : 'Open menu'
          }
        >
          {/* The same marker the navbar and the sidebar use. This drew ☰
              (U+2630) before — a CJK trigram whose weight and baseline are
              whatever the system font decides, so it sat differently on every
              device and matched nothing else in the product. */}
          <span aria-hidden="true" className="text-lg leading-none">
            🍔
          </span>
          {/*
            The mark AND the word. It rendered the word alone on width grounds,
            which made this the one surface in the product where the brand had
            no mark at all — on the route whose whole job is showing pictures.
            22px of lockup is affordable; the centre of the frame is still clear.
          */}
          <BrandWordmark
            logoSize={22}
            showName
            className="gap-1.5"
            
          />
        </button>

        {/*
          The shared badge: a numeral in the brand colour, no plate.

          This drew a filled rose disc, which on a full-bleed photograph was the
          highest-contrast object on the screen — louder than the image the page
          exists to show. `CountBadge` carries its contrast in a text shadow
          instead, which is the same technique the rest of this chrome uses.
        */}
        <CountBadge count={unreadCount} />
      </div>

      {/*
        Search stays on this route rather than moving to Market only.

        Looking for a designer is a Runway-native intent — you see a look and
        want more from whoever made it — so sending the reader to another
        surface to start that search breaks the thread they are already
        pulling on.
      */}
      <button
        type="button"
        onClick={() => navigate('/search')}
        className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${GLASS_SURFACE}`}
        aria-label="Search"
      >
        <span aria-hidden="true" className="text-base leading-none">
          🔍
        </span>
        </button>
      </div>
    </>
  );
};

export default RunwayStageChrome;

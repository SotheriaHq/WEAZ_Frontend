import type { SavedPaymentCardSummary } from '@/api/PaymentApi';

/**
 * A saved card, drawn as a card.
 *
 * The checkout used to list saved cards as bordered rows of prose — "visa (TEST
 * BANK) ending 0409 / Exp 01/2030 · Reusable" — which reads like a database row
 * about a card rather than the thing itself. People do not recognise their own
 * card by a sentence; they recognise it by the network mark, the issuer, and the
 * last four digits in the place those digits live.
 *
 * So the geometry is the real one: `aspect-[1.586]` is ID-1, the ISO/IEC 7810
 * ratio every payment card in a wallet is cut to. The digits are grouped in
 * fours with tabular figures, the expiry reads `MM/YY` like an embossed card
 * rather than `01/2030`, and the issuer sits top-left where an issuer sits.
 *
 * Nothing sensitive is involved: brand, issuing bank, last four and expiry are
 * all the card already tells a cashier, and they are all WIEZ ever receives —
 * the pan itself never reaches this application.
 *
 * Network marks are TYPOGRAPHIC, not images. Rule 5 keeps icon libraries out of
 * the UI, `threadly/no-raw-media-elements` keeps raw `<img>` out, and shipping
 * the networks' own logo files would mean shipping their trademarks. A wordmark
 * set in the network's own palette is recognisable without either problem.
 */

type CardNetwork = {
  /** What the network calls itself, as it appears on the card. */
  wordmark: string;
  /** Tailwind gradient stops for the card body, in that network's palette. */
  surface: string;
  /** Tone for the wordmark plate, so it reads as printed ON the card. */
  plate: string;
};

const NETWORKS: Record<string, CardNetwork> = {
  visa: {
    wordmark: 'VISA',
    surface: 'from-[#1a1f71] via-[#2c3a9e] to-[#4453c4]',
    plate: 'text-white',
  },
  mastercard: {
    wordmark: 'Mastercard',
    surface: 'from-[#1c1c1c] via-[#3d2b1f] to-[#7a3c10]',
    plate: 'text-[#ff9f2d]',
  },
  verve: {
    wordmark: 'verve',
    surface: 'from-[#0f0f10] via-[#3a1216] to-[#8c1d2b]',
    plate: 'text-[#ff5a68]',
  },
  amex: {
    wordmark: 'AMEX',
    surface: 'from-[#0b5d8f] via-[#107ab5] to-[#2ea6dd]',
    plate: 'text-white',
  },
  discover: {
    wordmark: 'DISCOVER',
    surface: 'from-[#1d1d1f] via-[#4a3410] to-[#e06c00]',
    plate: 'text-[#ffb000]',
  },
};

/** The neutral card, for a network WIEZ has no palette for. */
const UNKNOWN_NETWORK: CardNetwork = {
  wordmark: 'CARD',
  surface: 'from-slate-700 via-slate-800 to-slate-900',
  plate: 'text-white',
};

export const resolveCardNetwork = (brand: string | null | undefined): CardNetwork => {
  const normalized = String(brand ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!normalized) return UNKNOWN_NETWORK;

  if (normalized.includes('visa')) return NETWORKS.visa;
  if (normalized.includes('master')) return NETWORKS.mastercard;
  if (normalized.includes('verve')) return NETWORKS.verve;
  if (normalized.includes('americanexpress') || normalized.includes('amex')) {
    return NETWORKS.amex;
  }
  if (normalized.includes('discover')) return NETWORKS.discover;
  return UNKNOWN_NETWORK;
};

/**
 * `01/2030` is a database value; `01/30` is what is embossed on the card the
 * person is holding. Anything that is not a four-digit year is left alone
 * rather than guessed at.
 */
export const formatCardExpiry = (
  expMonth: string | null | undefined,
  expYear: string | null | undefined,
): string | null => {
  const month = String(expMonth ?? '').trim();
  const year = String(expYear ?? '').trim();
  if (!month || !year) return null;

  const paddedMonth = month.length === 1 ? `0${month}` : month;
  const shortYear = /^\d{4}$/.test(year) ? year.slice(-2) : year;
  return `${paddedMonth}/${shortYear}`;
};

export function SavedCardFace({
  card,
  selected = false,
  busy = false,
  onSelect,
}: {
  card: SavedPaymentCardSummary;
  selected?: boolean;
  busy?: boolean;
  onSelect?: () => void;
}) {
  const network = resolveCardNetwork(card.brand);
  const expiry = formatCardExpiry(card.expMonth, card.expYear);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${network.wordmark} card ending ${card.last4}${
        card.bank ? `, issued by ${card.bank}` : ''
      }${card.isDefault ? ', default card' : ''}`}
      className={`group relative block w-full max-w-[22rem] overflow-hidden rounded-[18px] bg-gradient-to-br text-left shadow-lg transition ${
        network.surface
      } ${
        selected
          ? 'ring-2 ring-fuchsia-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
          : 'opacity-95 hover:opacity-100 hover:shadow-xl'
      } ${busy ? 'pointer-events-none animate-pulse' : ''}`}
    >
      {/*
        The sheen a physical card has under a light. One soft diagonal, not a
        pile of effects — the card is the object here, and anything else on it
        competes with the four digits the person is actually looking for.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1/4 -top-1/2 h-[200%] w-[80%] rotate-12 bg-white/[0.07]"
      />

      <span className="relative flex aspect-[1.586] flex-col justify-between p-5">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            {card.bank || 'Bank card'}
          </span>
          <span
            className={`shrink-0 rounded-md bg-black/25 px-2 py-1 text-xs font-black italic tracking-wide ${network.plate}`}
          >
            {network.wordmark}
          </span>
        </span>

        {/*
          Only the last group is real. The bullets are not a mask over hidden
          digits — WIEZ never receives the other twelve — so they are rendered
          as the placeholders they are, at the spacing a card uses.
        */}
        <span className="flex items-baseline gap-3 font-mono text-lg tabular-nums text-white">
          <span aria-hidden className="tracking-[0.2em] text-white/55">
            ••••
          </span>
          <span aria-hidden className="tracking-[0.2em] text-white/55">
            ••••
          </span>
          <span aria-hidden className="tracking-[0.2em] text-white/55">
            ••••
          </span>
          <span className="tracking-[0.15em]">{card.last4}</span>
        </span>

        <span className="flex items-end justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Expires
            </span>
            <span className="font-mono text-sm tabular-nums text-white">
              {expiry ?? '--/--'}
            </span>
          </span>

          <span className="flex items-center gap-2">
            {card.isDefault ? (
              <span className="rounded-full bg-white/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white">
                Default
              </span>
            ) : null}
            {selected ? (
              <span
                className="text-base"
                aria-hidden
                title="Selected for this payment"
              >
                ✅
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}

export default SavedCardFace;

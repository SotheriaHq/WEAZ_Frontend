import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MarketTrendingHero from '@/components/market/MarketTrendingHero';
import { CLIP_EMOJI } from '@/constants/clipping';

/**
 * The promises the Market hero makes.
 *
 * What it replaced showed ONE photograph of each piece and rotated between
 * three of them on a timer, with "✨ Tap to preview" where the price should
 * have been. The rules below are the ones that redesign exists to hold.
 */

const toggleClip = vi.fn();

vi.mock('@/features/clipping/useClipTarget', () => ({
  useClipTarget: () => ({ toggleClip, setClipStatus: vi.fn() }),
}));

vi.mock('@/query/queries', () => ({
  useSavedStatusQuery: () => ({ data: false }),
}));

vi.mock('@/components/ImageWithFallback', () => ({
  default: ({ alt, src }: { alt: string; src: string | null }) => (
    <img alt={alt} src={src ?? ''} />
  ),
}));

const product = (id: string, name: string, images: string[]) =>
  ({
    id,
    name,
    thumbnail: images[0] ?? null,
    images,
    price: 59000,
    effectivePrice: 59000,
    brand: { name: "Nuel's Cotour" },
  }) as never;

const PRODUCTS = [
  product('p1', 'Him Face', ['/a-1.jpg', '/a-2.jpg', '/a-3.jpg']),
  product('p2', 'The North', ['/b-1.jpg']),
  product('p3', 'Drill', ['/c-1.jpg']),
  product('p4', 'Agbada', ['/d-1.jpg']),
];

const noop = () => {};

beforeEach(() => {
  toggleClip.mockClear();
});

describe('the market trending hero', () => {
  it('carousels the featured piece’s own angles, not other products', async () => {
    const user = userEvent.setup();
    render(
      <MarketTrendingHero products={PRODUCTS} onOpenProduct={noop} onSeeAll={noop} />,
    );

    // Three images on the first piece means three dots, and the alt text says
    // which view is showing.
    expect(screen.getByAltText('Him Face — view 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next view' }));
    expect(screen.getByAltText('Him Face — view 2 of 3')).toBeInTheDocument();

    // Still the same garment: advancing a view must not advance the product.
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Him Face');
  });

  it('wraps at both ends of the angles', async () => {
    const user = userEvent.setup();
    render(
      <MarketTrendingHero products={PRODUCTS} onOpenProduct={noop} onSeeAll={noop} />,
    );

    await user.click(screen.getByRole('button', { name: 'Previous view' }));
    expect(screen.getByAltText('Him Face — view 3 of 3')).toBeInTheDocument();
  });

  it('lists what comes next, with brand, name and price on every row', () => {
    render(
      <MarketTrendingHero products={PRODUCTS} onOpenProduct={noop} onSeeAll={noop} />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);

    // A queue: the pieces AFTER the featured one, in order.
    expect(rows[0]).toHaveTextContent('The North');
    expect(rows[1]).toHaveTextContent('Drill');
    expect(rows[2]).toHaveTextContent('Agbada');

    // The row carries what a shopper decides on. "Tap to preview" did not.
    expect(within(rows[0]).getByText('₦59,000')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("Nuel's Cotour");
    expect(screen.queryByText(/tap to preview/i)).not.toBeInTheDocument();
  });

  it('clips rather than hearts', async () => {
    const user = userEvent.setup();
    render(
      <MarketTrendingHero products={PRODUCTS} onOpenProduct={noop} onSeeAll={noop} />,
    );

    // A heart is a like — a public opinion. Clipping is private and practical.
    expect(screen.queryByText('❤️')).not.toBeInTheDocument();
    expect(screen.getByText(CLIP_EMOJI)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clip/i }));
    expect(toggleClip).toHaveBeenCalledWith({
      targetType: 'PRODUCT',
      targetId: 'p1',
      clipped: false,
    });
  });

  it('opens each piece independently', async () => {
    const user = userEvent.setup();
    const onOpenProduct = vi.fn();
    render(
      <MarketTrendingHero products={PRODUCTS} onOpenProduct={onOpenProduct} onSeeAll={noop} />,
    );

    await user.click(screen.getAllByRole('listitem')[1].querySelector('button')!);
    expect(onOpenProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p3' }),
      expect.objectContaining({ source: 'market_hero_up_next' }),
    );
  });

  it('says so plainly when the day has nothing', () => {
    render(<MarketTrendingHero products={[]} onOpenProduct={noop} onSeeAll={noop} />);
    expect(screen.getByText(/no trending pieces yet today/i)).toBeInTheDocument();
  });
});

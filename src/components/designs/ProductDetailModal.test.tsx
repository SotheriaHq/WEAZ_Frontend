import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetailModal, { ProductDetailData } from './ProductDetailModal';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockBagProduct = vi.fn().mockResolvedValue({ success: true });

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: any) => any) =>
    selector({
      wishlist: { wishlistedIds: new Set() },
      user: { isAuthenticated: true, profile: { id: 'shopper-123' } },
    }),
}));

vi.mock('@/hooks/useBagging', () => ({
  useBagging: () => ({
    bagProduct: mockBagProduct,
  }),
}));

// Mock MediaRenderer to keep test lightweight
vi.mock('@/components/media/MediaRenderer', () => ({
  default: ({ alt }: { alt: string }) => <div data-testid="media-renderer">{alt}</div>,
}));

// Mock BagPulseIcon to verify render without internal SVG complexity
vi.mock('@/components/bagging/BagPulseIcon', () => ({
  default: ({ status, size }: { status: string; size: number }) => (
    <span data-testid="bag-pulse-icon" data-status={status} data-size={size}>
      PulseIcon
    </span>
  ),
}));

const mockProduct: ProductDetailData = {
  id: 'prod-456',
  name: 'Velvet Evening Agbada',
  description: 'Handcrafted luxury velvet agbada with intricate metallic embroidery.',
  price: 150000,
  salePrice: 120000,
  images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  thumbnail: 'https://example.com/thumb.jpg',
  sizes: ['M', 'L', 'XL'],
  sizeStock: { M: 5, L: 2, XL: 0 },
  colors: ['Purple', 'Gold'],
  totalStock: 7,
  brand: {
    id: 'brand-999',
    name: 'Maison De L\'Ombre',
  },
  rating: 4.8,
  reviewsCount: 24,
};

describe('Wave 4A Product Detail Vertical Slice (ProductDetailModal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with semantic surface and quiet image stage', () => {
    render(
      <ProductDetailModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const surface = dialog.querySelector('.neu-modal-surface');
    expect(surface?.className).toContain('var(--wiez-surface-modal)');
    expect(surface?.className).toContain('var(--wiez-border-subtle)');

    expect(screen.getByRole('heading', { level: 1, name: 'Velvet Evening Agbada' })).toBeInTheDocument();
    expect(screen.getByText(/Maison De L'Ombre/)).toBeInTheDocument();
  });

  it('renders Add to Bag CTA consuming canonical Button with brand variant and tactile active depth', () => {
    render(
      <ProductDetailModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
      />
    );

    // Initial state: size not selected -> Add to Bag is disabled
    const bagButtons = screen.getAllByRole('button', { name: /Bag it/i });
    const mainBagBtn = bagButtons[0];
    expect(mainBagBtn).toBeDisabled();

    // Canonical button contains WIEZ action-brand tokens and active tactile inset depth
    expect(mainBagBtn.className).toContain('var(--wiez-action-brand)');
    expect(mainBagBtn.className).toContain('active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)]');

    // Contains BagPulseIcon
    const pulseIcons = screen.getAllByTestId('bag-pulse-icon');
    expect(pulseIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('applies tactile neumorphic pressed chip tokens to size selection', () => {
    render(
      <ProductDetailModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
      />
    );

    const sizeM = screen.getByRole('button', { name: 'M' });
    const sizeXL = screen.getByRole('button', { name: 'XL' });

    // Inactive size has neu-pressed-button
    expect(sizeM.className).toContain('neu-pressed-button');

    // Out of stock size is disabled
    expect(sizeXL).toBeDisabled();

    // Clicking available size activates neu-inset-chip selected with action-brand
    fireEvent.click(sizeM);
    expect(sizeM.className).toContain('neu-inset-chip');
    expect(sizeM.className).toContain('selected');
    expect(sizeM.className).toContain('var(--wiez-action-brand)');
  });

  it('triggers bagging mutation cleanly without distorting commercial business logic', async () => {
    const onClose = vi.fn();
    render(
      <ProductDetailModal
        isOpen={true}
        onClose={onClose}
        product={mockProduct}
      />
    );

    // Select size 'M'
    fireEvent.click(screen.getByRole('button', { name: 'M' }));

    // Now main Add to Bag button is enabled
    const bagButtons = screen.getAllByRole('button', { name: /Bag it/i });
    const mainBagBtn = bagButtons[0];
    expect(mainBagBtn).not.toBeDisabled();

    // Click Add to Bag
    fireEvent.click(mainBagBtn);

    expect(mockBagProduct).toHaveBeenCalledTimes(1);
    expect(mockBagProduct).toHaveBeenCalledWith(
      { id: 'prod-456', name: 'Velvet Evening Agbada' },
      { size: 'M', color: 'Purple', quantity: 1 }
    );
  });

  it('renders Wishlist and Share secondary actions consuming canonical Button styling', () => {
    render(
      <ProductDetailModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
      />
    );

    const wishlistBtns = screen.getAllByRole('button', { name: /Add to Wishlist/i });
    // wishlistBtns[0] is media heart button, wishlistBtns[1] is the secondary CTA
    const secondaryWishlistBtn = wishlistBtns[1];
    expect(secondaryWishlistBtn.className).toContain('neu-pressed-button');

    const shareBtn = screen.getByRole('button', { name: /Share product/i });
    expect(shareBtn.className).toContain('neu-pressed-button');
  });
});

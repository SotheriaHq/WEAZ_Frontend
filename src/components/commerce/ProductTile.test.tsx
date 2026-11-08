import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BAG_IT_EMOJI, BAG_IT_LABEL } from '@/constants/bagging';
import { BagItButton, ProductTile, PRODUCT_TILE_MEDIA_ASPECT, PRODUCT_TILE_MEDIA_RATIO } from './ProductTile';
import { resolveMarketSectionFormat, getMarketSectionEmoji, MARKET_RHYTHM } from '@/constants/marketSections';

describe('BagItButton', () => {
  it('shows the one bag mark and beats while bagging is possible', () => {
    const onClick = vi.fn();
    render(<BagItButton onClick={onClick} />);
    const button = screen.getByRole('button', { name: BAG_IT_LABEL });
    expect(button.textContent).toContain(BAG_IT_EMOJI);
    expect(button.className).toContain('wiez-bag-heartbeat');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('never lets a tap fall through to the card underneath', () => {
    const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <BagItButton onClick={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: BAG_IT_LABEL }));
    expect(onCard).not.toHaveBeenCalled();
  });

  it('is still and inert when no bag is possible', () => {
    const onClick = vi.fn();
    render(<BagItButton onClick={onClick} disabled />);
    const button = screen.getByRole('button', { name: BAG_IT_LABEL });
    expect(button.className).not.toContain('wiez-bag-heartbeat');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not send a second bag request while one is in flight', () => {
    const onClick = vi.fn();
    render(<BagItButton onClick={onClick} busy />);
    const button = screen.getByRole('button', { name: BAG_IT_LABEL });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.className).not.toContain('wiez-bag-heartbeat');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ProductTile', () => {
  it('frames the photo at the shared 100:148 ratio', () => {
    expect(PRODUCT_TILE_MEDIA_ASPECT).toBe('aspect-[100/148]');
    expect(PRODUCT_TILE_MEDIA_RATIO).toBeCloseTo(148 / 100);
    const { container } = render(
      <ProductTile.Root>
        <ProductTile.Media />
        <ProductTile.Body>
          <ProductTile.Title>Name</ProductTile.Title>
        </ProductTile.Body>
      </ProductTile.Root>,
    );
    expect(container.querySelector(`.${CSS.escape(PRODUCT_TILE_MEDIA_ASPECT)}`)).not.toBeNull();
  });

  it('reserves two title lines so a row of cards lines up', () => {
    render(<ProductTile.Title>Short</ProductTile.Title>);
    expect(screen.getByRole('heading', { name: 'Short' }).className).toContain('min-h-[2.75em]');
  });
});

describe('market section formats', () => {
  it('draws each entity in its own shape', () => {
    expect(resolveMarketSectionFormat('HORIZONTAL_RAIL', ['PRODUCT'])).toBe('product-rail');
    expect(resolveMarketSectionFormat('PRODUCT_GRID', ['PRODUCT'])).toBe('product-grid');
    expect(resolveMarketSectionFormat('HORIZONTAL_RAIL', ['COLLECTION', 'COLLECTION'])).toBe('collection-rail');
    expect(resolveMarketSectionFormat('COLLECTION_RAIL', ['PRODUCT'])).toBe('product-rail');
    expect(resolveMarketSectionFormat('BRAND_RAIL', ['BRAND'])).toBe('brand-rail');
    expect(resolveMarketSectionFormat('CATEGORY_GRID', ['CATEGORY'])).toBe('category-grid');
    expect(resolveMarketSectionFormat('CATEGORY_GRID', ['CATEGORY', 'PRODUCT'])).toBe('product-rail');
  });

  it('never uses the bag mark as a section marker', () => {
    expect(getMarketSectionEmoji('fresh-drops', 'product-rail')).not.toBe(BAG_IT_EMOJI);
    expect(getMarketSectionEmoji('unknown', 'product-rail')).not.toBe(BAG_IT_EMOJI);
  });

  it('separates sections by at least three times the title-to-cards space', () => {
    expect(MARKET_RHYTHM.betweenSections).toBeGreaterThanOrEqual(MARKET_RHYTHM.headerToContent * 3);
  });
});

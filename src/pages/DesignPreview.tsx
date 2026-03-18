/**
 * DesignPreview — Card Design Comparison Page
 *
 * Route: /design-preview  (add to router, no auth required)
 *
 * Shows the new "editorial" card design alongside the current card pattern
 * so you can compare and choose which direction feels right before applying
 * the winner across the product.
 *
 * This file is a standalone preview — it has no API calls, uses static
 * placeholder data, and carries zero production state risk.
 */

import React, { useState } from 'react';

// ─── Static placeholder data ─────────────────────────────────────────────────

const CARDS = [
  {
    id: '1',
    brandName: 'Adire Collective',
    title: 'Hand-dyed Adire Evening Set',
    priceRange: '₦ 85,000 – ₦ 120,000',
    tag: 'New Arrival',
    // Unsplash free-to-use editorial fashion images
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80',
  },
  {
    id: '2',
    brandName: 'Ẹwà Studio',
    title: 'Structured Linen Co-ord',
    priceRange: '₦ 42,000 – ₦ 68,000',
    tag: 'Limited',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80',
  },
  {
    id: '3',
    brandName: 'Lagos Drape House',
    title: 'Editorial Wrap Dress Collection',
    priceRange: '₦ 55,000',
    tag: null,
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80',
  },
];

// ─── New Editorial Card ───────────────────────────────────────────────────────
// Design principles:
// - Image takes 75% of the card height (4:5 ratio) — the garment leads
// - No drop shadow on white — border only
// - Brand name in uppercase spaced label (fashion editorial signal)
// - Collection name in Playfair Display, font-weight 400 (light = luxury)
// - Price small and right-aligned — supporting info, not a headline
// - Hover: image scales 1.02 via transform only (compositor-safe, no paint)
// - No border-radius on the image — only the outer card has a subtle radius

const EditorialCard: React.FC<(typeof CARDS)[0]> = ({
  brandName,
  title,
  priceRange,
  tag,
  image,
}) => {
  return (
    <article
      className="group relative flex flex-col bg-white border border-[#e5e5e5] rounded-[4px] overflow-hidden cursor-pointer"
      style={{ boxShadow: 'none' }}
    >
      {/* Image — 4:5 aspect ratio, full bleed */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/5' }}>
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          style={{ display: 'block' }}
        />

        {/* Optional tag — top-left, minimal */}
        {tag && (
          <span
            className="absolute top-3 left-3 text-[10px] font-medium tracking-[0.08em] uppercase px-2.5 py-1 bg-white text-[#0d0d0d]"
            style={{ letterSpacing: '0.08em' }}
          >
            {tag}
          </span>
        )}
      </div>

      {/* Text block — kept minimal, left-aligned */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1">
        {/* Brand name — uppercase, spaced, secondary color */}
        <p
          className="text-[10px] font-medium uppercase tracking-[0.1em]"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}
        >
          {brandName}
        </p>

        {/* Collection title — Playfair Display, regular weight, near-black */}
        <h3
          className="font-serif font-normal leading-snug"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '0.9375rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>

        {/* Price — small, muted, right-aligned */}
        <p
          className="text-right text-[11px] font-medium mt-0.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {priceRange}
        </p>
      </div>
    </article>
  );
};

// ─── Current Card Pattern (approximation for comparison) ─────────────────────
// Mirrors the visual character of the existing DesignCard / CollectionCard:
// gradient-tinted surface, backdrop-blur overlays, rounded-2xl, shadow

const CurrentCard: React.FC<(typeof CARDS)[0]> = ({
  brandName,
  title,
  priceRange,
  tag,
  image,
}) => {
  return (
    <article className="group relative flex flex-col bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-gray-200/70 dark:border-white/10 rounded-2xl overflow-hidden shadow-glass cursor-pointer hover:shadow-glass-hover transition-all duration-200">
      {/* Image */}
      <div className="relative overflow-hidden rounded-t-2xl" style={{ aspectRatio: '4/5' }}>
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          style={{ display: 'block' }}
        />

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Tag chip */}
        {tag && (
          <span className="absolute top-3 left-3 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-purple-500/80 backdrop-blur-sm text-white border border-white/20">
            {tag}
          </span>
        )}

        {/* Brand name overlaid on image */}
        <p className="absolute bottom-3 left-3 text-[11px] font-semibold text-white/80 uppercase tracking-wide">
          {brandName}
        </p>
      </div>

      {/* Text block */}
      <div className="px-3 pt-2 pb-3 flex flex-col gap-1">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-snug line-clamp-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{priceRange}</p>
      </div>
    </article>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const DesignPreview: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div
      className={darkMode ? 'dark' : ''}
      style={{ minHeight: '100vh', backgroundColor: darkMode ? '#0a0a0a' : '#ffffff' }}
    >
      {/* ── Header ── */}
      <div
        style={{
          borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e5e5e5'}`,
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: darkMode ? '#0a0a0a' : '#ffffff',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: darkMode ? '#a3a3a3' : '#78716c',
              marginBottom: '4px',
            }}
          >
            Design Preview — Item 8
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.5rem',
              fontWeight: 400,
              color: darkMode ? '#f5f5f5' : '#0d0d0d',
              letterSpacing: '-0.02em',
            }}
          >
            Card Design Comparison
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: darkMode ? '#a3a3a3' : '#78716c',
              marginTop: '4px',
            }}
          >
            Left: current card pattern &nbsp;·&nbsp; Right: new editorial direction
          </p>
        </div>

        <button
          onClick={() => setDarkMode((d) => !d)}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 500,
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : '#d4d4d4'}`,
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: darkMode ? '#f5f5f5' : '#0d0d0d',
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      {/* ── Split comparison ── */}
      <div style={{ padding: '48px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Current */}
        <section>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: darkMode ? '#a3a3a3' : '#78716c', marginBottom: '6px' }}>
              Current
            </p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1rem', fontWeight: 600, color: darkMode ? '#f5f5f5' : '#0d0d0d' }}>
              Glassmorphism + Gradient
            </h2>
            <p style={{ fontSize: '12px', color: darkMode ? '#a3a3a3' : '#78716c', marginTop: '4px', lineHeight: 1.5 }}>
              Backdrop blur, gradient text title, purple badge, gradient bottom overlay
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            {CARDS.map((card) => (
              <CurrentCard key={card.id} {...card} />
            ))}
          </div>
        </section>

        {/* New editorial */}
        <section>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: darkMode ? '#a3a3a3' : '#78716c', marginBottom: '6px' }}>
              Proposed
            </p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1rem', fontWeight: 600, color: darkMode ? '#f5f5f5' : '#0d0d0d' }}>
              Editorial Minimal
            </h2>
            <p style={{ fontSize: '12px', color: darkMode ? '#a3a3a3' : '#78716c', marginTop: '4px', lineHeight: 1.5 }}>
              1px border, Playfair title, image leads, no shadow, hover via transform only
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            {CARDS.map((card) => (
              <EditorialCard key={card.id} {...card} />
            ))}
          </div>
        </section>
      </div>

      {/* ── Design notes ── */}
      <div
        style={{
          margin: '0 32px 64px',
          maxWidth: '1136px',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '24px',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e5e5e5'}`,
          borderRadius: '4px',
        }}
      >
        <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: darkMode ? '#a3a3a3' : '#78716c', marginBottom: '12px' }}>
          Design notes
        </p>
        <ul style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px', padding: 0, margin: 0, listStyle: 'none' }}>
          {[
            ['Image ratio', '4:5 — industry standard for fashion/Instagram'],
            ['Card border', '1px #e5e5e5 — white-on-white separation without shadow'],
            ['Title font', 'Playfair Display 400 — editorial, not SaaS'],
            ['Brand label', 'Uppercase 10px tracked — fashion editorial language'],
            ['Hover', 'transform: scale(1.02) — compositor-only, zero paint cost'],
            ['Shadow', 'None — on white background, border is sufficient'],
            ['Gradient text', 'Removed — solid color renders in OS text engine, no paint layer'],
            ['Blur', 'Removed from card surface — was forcing GPU composite per card'],
          ].map(([label, note]) => (
            <li key={label} style={{ fontSize: '12px', color: darkMode ? '#a3a3a3' : '#78716c', display: 'flex', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: darkMode ? '#f5f5f5' : '#0d0d0d', flexShrink: 0 }}>{label}:</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DesignPreview;

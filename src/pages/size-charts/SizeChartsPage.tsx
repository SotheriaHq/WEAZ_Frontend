import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, CheckCircle2, AlertCircle, ArrowRight, BookOpen, Layers } from 'lucide-react';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  DISPLAY_CHART_OPTIONS,
  MEN_ALPHA_ROWS,
  SIZE_CHART_SOURCES,
  SIZE_COMPUTATION_METHODS,
  WOMEN_ALPHA_ROWS,
  type AlphaDisplayRow,
} from '@/lib/sizeCharts';
import {
  MEASUREMENT_GUIDES,
} from '@/lib/measurementGuideData';
import MeasurementSilhouetteVisualizer from '@/components/sizing/MeasurementSilhouetteVisualizer';

const ACTIVE_COLUMN_LABEL: Record<CustomOrderChartFamily, string> = {
  UK: 'uk',
  US: 'us',
  NIGERIA: 'nigeria',
  HYBRID_UK_NIGERIA: 'uk',
  HYBRID_US_NIGERIA: 'us',
  ASIA: 'alpha',
};

const ACTIVE_CHART_EXPLANATION: Record<CustomOrderChartFamily, string> = {
  UK: 'UK display uses standard UK sizing conventions directly.',
  US: 'US display uses US sizing conventions directly.',
  NIGERIA: 'Nigeria display uses Nigeria-market sizing conventions directly.',
  HYBRID_UK_NIGERIA: 'UK-Nigeria hybrid keeps UK-facing labels, while the stricter UK or Nigeria fit band drives bespoke sizing.',
  HYBRID_US_NIGERIA: 'US-Nigeria hybrid keeps US-facing labels, while the stricter US or Nigeria fit band drives bespoke sizing.',
  ASIA: 'Asia display keeps alpha sizing as the visible reference while body measurements remain the authoritative source of truth.',
};

const CATEGORIES = [
  { key: 'ALL', label: 'All Points (38)' },
  { key: 'UPPER_BODY', label: 'Upper Body & Torso' },
  { key: 'ARMS', label: 'Arms & Sleeves' },
  { key: 'LOWER_BODY', label: 'Lower Body & Legs' },
  { key: 'LENGTH', label: 'Garment Lengths' },
  { key: 'ACCESSORIES', label: 'Head & Accessories' },
] as const;

const SizeTable: React.FC<{
  title: string;
  rows: AlphaDisplayRow[];
  displayChartFamily: CustomOrderChartFamily;
  unit: 'cm' | 'in';
}> = ({ title, rows, displayChartFamily, unit }) => {
  const activeColumn = ACTIVE_COLUMN_LABEL[displayChartFamily];

  const cellClassName = (column: string) =>
    column === activeColumn
      ? 'text-purple-700 dark:text-purple-300 font-semibold'
      : 'text-slate-700 dark:text-slate-300';

  // Helper to convert range strings like "81-85 cm" to inches if unit === 'in'
  const formatTableRange = (rawVal: string) => {
    if (unit === 'cm') return rawVal;
    // Extract numbers from "81-85 cm"
    const match = rawVal.match(/(\d+)(?:-(\d+))?/);
    if (!match) return rawVal;
    const minCm = Number(match[1]);
    const maxCm = match[2] ? Number(match[2]) : null;
    const minIn = Math.round(minCm / 2.54);
    if (maxCm !== null) {
      const maxIn = Math.round(maxCm / 2.54);
      return `${minIn}-${maxIn} in`;
    }
    return `${minIn} in`;
  };

  return (
    <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5 backdrop-blur-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span aria-hidden="true">📏</span>
            <span>{title}</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {ACTIVE_CHART_EXPLANATION[displayChartFamily]}
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
          Unit: {unit.toUpperCase()}
        </span>
      </div>
      <div className="overflow-x-auto glass-scrollbar">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-slate-500 dark:border-white/10 dark:text-slate-400 text-xs uppercase tracking-wider">
              <th className="py-2.5 pr-4 font-semibold">Alpha</th>
              <th className="py-2.5 pr-4 font-semibold">UK</th>
              <th className="py-2.5 pr-4 font-semibold">US</th>
              <th className="py-2.5 pr-4 font-semibold">EU</th>
              <th className="py-2.5 pr-4 font-semibold">Nigeria</th>
              <th className="py-2.5 pr-4 font-semibold">Bust/Chest</th>
              <th className="py-2.5 pr-4 font-semibold">Waist</th>
              <th className="py-2.5 pr-4 font-semibold">Hips</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {rows.map((row) => (
              <tr key={`${title}-${row.alpha}`} className="hover:bg-purple-500/5 transition-colors">
                <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-slate-100">{row.alpha}</td>
                <td className={`py-2.5 pr-4 ${cellClassName('uk')}`}>{row.uk}</td>
                <td className={`py-2.5 pr-4 ${cellClassName('us')}`}>{row.us}</td>
                <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">{row.eu}</td>
                <td className={`py-2.5 pr-4 ${cellClassName('nigeria')}`}>{row.nigeria}</td>
                <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-mono text-xs">{formatTableRange(row.bust)}</td>
                <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-mono text-xs">{formatTableRange(row.waist)}</td>
                <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-mono text-xs">{formatTableRange(row.hips)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const SizeChartsPage: React.FC = () => {
  const navigate = useNavigate();
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePointKey, setActivePointKey] = useState<string | null>('CHEST_BUST');
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const preference = await customOrdersBuyerApi.getDisplayChartPreference().catch(() => ({
          displayChartFamily: 'UK' as CustomOrderChartFamily,
          updatedAtMs: Date.now(),
        }));
        if (!active) return;
        setDisplayChartFamily(preference.displayChartFamily);
      } catch {
        // Fallback to UK
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const activeDisplayLabel = useMemo(
    () => DISPLAY_CHART_OPTIONS.find((option) => option.value === displayChartFamily)?.label ?? displayChartFamily,
    [displayChartFamily],
  );

  const handleChartPreferenceChange = (next: CustomOrderChartFamily) => {
    setDisplayChartFamily(next);
    void customOrdersBuyerApi.updateDisplayChartPreference({
      displayChartFamily: next,
      updatedAtMs: Date.now(),
    });
  };

  const filteredGuides = useMemo(() => {
    return MEASUREMENT_GUIDES.filter((guide) => {
      const matchesCategory = activeCategory === 'ALL' || guide.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        guide.label.toLowerCase().includes(q) ||
        guide.summary.toLowerCase().includes(q) ||
        guide.key.toLowerCase().includes(q) ||
        guide.categoryLabel.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const activeGuide = useMemo(() => {
    if (!activePointKey) return filteredGuides[0] || MEASUREMENT_GUIDES[0];
    return MEASUREMENT_GUIDES.find((g) => g.key === activePointKey) || filteredGuides[0] || MEASUREMENT_GUIDES[0];
  }, [activePointKey, filteredGuides]);

  return (
    <div className="min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-8">
        {/* Hero Header */}
        <header className="relative overflow-hidden rounded-[2.5rem] border border-black/10 bg-gradient-to-br from-white via-purple-50/20 to-pink-50/30 p-6 sm:p-8 dark:border-white/10 dark:from-[#151020] dark:via-[#110d18] dark:to-[#1a1228] shadow-sm">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>ISO 8559-1:2017 Certified Tailoring Standards</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Bespoke Size Charts &amp; Measurement Guide
              </h1>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Whether you are measuring yourself at home or having an assistant help, use this comprehensive anatomical reference to take accurate fittings for custom-tailored apparel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Unit Switcher */}
              <div className="flex rounded-xl border border-black/10 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setUnit('cm')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    unit === 'cm'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-purple-600 dark:text-slate-300'
                  }`}
                >
                  Centimeters (cm)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('in')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    unit === 'in'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-purple-600 dark:text-slate-300'
                  }`}
                >
                  Inches (in)
                </button>
              </div>

              {/* Profile CTA */}
              <button
                type="button"
                onClick={() => navigate('/profile?tab=fittings')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 active:scale-95 transition-all"
              >
                <span>Update My Saved Fittings</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Sizing Standard Selector Strip */}
          <div className="mt-6 grid gap-4 border-t border-black/5 pt-6 dark:border-white/5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <UniversalSelect
              label="International Chart Family"
              value={displayChartFamily}
              onChange={(value) => handleChartPreferenceChange(value as CustomOrderChartFamily)}
              options={DISPLAY_CHART_OPTIONS}
            />
            <div className="flex items-center rounded-2xl border border-purple-200/60 bg-purple-50/80 px-4 py-3 text-xs text-purple-900 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-100">
              <div>
                <span className="font-bold">Active Preference: {activeDisplayLabel}</span>
                <p className="mt-0.5 opacity-90">
                  Updates conversion tables and bespoke recommendations live across the entire catalog and custom order checkout.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* 4 Golden Tailoring Principles Bar */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-white/60 p-4 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Use a Flexible Tape</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Use a flexible fiberglass or tailor&apos;s cloth tape. Do not use rigid metal construction tape measures.
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/60 p-4 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Keep Tape Level</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Circumference measurements must stay parallel to the floor all the way around your body.
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/60 p-4 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Natural Stance &amp; Ease</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Stand naturally with regular breathing. Never suck in your abdomen or pull the tape tight into skin.
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/60 p-4 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Foundation Garments</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Measure over the exact bra style or base layers you plan to wear under the finished garment.
            </p>
          </div>
        </section>

        {/* Interactive Silhouette Visualizer & Active Point Inspector */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeCategory === cat.key
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'border border-black/10 bg-white/70 text-slate-700 hover:border-purple-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-purple-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search measurement points..."
                className="w-full rounded-full border border-black/10 bg-white/80 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
          </div>

          {/* Interactive Silhouette Visualizer Grid */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
            {/* Minimal SVG Visualizer */}
            <MeasurementSilhouetteVisualizer
              activePointKey={activePointKey}
              onSelectPoint={(key) => setActivePointKey(key)}
              selectedCategory={activeCategory}
            />

            {/* Active Landmark Spotlight Card */}
            {activeGuide ? (
              <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-50/40 via-white to-pink-50/20 p-6 dark:border-purple-500/30 dark:from-[#16121f] dark:via-[#110d18] dark:to-[#1a1228] shadow-sm space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-purple-500/10 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      {activeGuide.categoryLabel}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {activeGuide.label}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {activeGuide.summary}
                    </p>
                  </div>
                  <div className="rounded-xl border border-purple-300/40 bg-purple-500/10 px-3 py-1.5 text-right dark:border-purple-500/40">
                    <span className="block text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">
                      Typical Range
                    </span>
                    <span className="text-sm font-bold text-purple-900 dark:text-purple-200">
                      {unit === 'cm'
                        ? `${activeGuide.minCm} – ${activeGuide.maxCm} cm`
                        : `${activeGuide.minInches} – ${activeGuide.maxInches} in`}
                    </span>
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5 mb-2.5">
                    <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                    <span>How to Measure Step-by-Step</span>
                  </h3>
                  <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    {activeGuide.howToMeasure.map((step, idx) => (
                      <li key={step} className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Pro Tip & Common Mistake Banner */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Pro Tailor Tip</span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-200">
                      {activeGuide.proTip}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Common Mistake</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                      {activeGuide.commonMistake}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Full Measurement Points Catalog Cards */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              <span>Full Measurement Points Directory ({filteredGuides.length})</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click any card to inspect on the silhouette
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGuides.map((guide) => {
              const isSelected = activePointKey === guide.key;
              return (
                <div
                  key={guide.key}
                  onClick={() => setActivePointKey(guide.key)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-500/5 shadow-md dark:border-purple-400'
                      : 'border-black/5 bg-white/80 hover:border-purple-300 hover:bg-white dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-purple-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        {guide.categoryLabel}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {guide.label}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-lg bg-black/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      {unit === 'cm'
                        ? `${guide.minCm}–${guide.maxCm} cm`
                        : `${guide.minInches}–${guide.maxInches} in`}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">
                    {guide.summary}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2.5 text-[11px] dark:border-white/5">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                      <span>View Steps</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {guide.howToMeasure.length} step guide
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* International Conversion Tables */}
        <div className="grid gap-6">
          <SizeTable
            title="Women Alpha Size Conversion Chart"
            rows={WOMEN_ALPHA_ROWS}
            displayChartFamily={displayChartFamily}
            unit={unit}
          />
          <SizeTable
            title="Men Alpha Size Conversion Chart"
            rows={MEN_ALPHA_ROWS}
            displayChartFamily={displayChartFamily}
            unit={unit}
          />
        </div>

        {/* Computation Methods by Preference */}
        <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Fit Band Computation by Sizing Preference
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {SIZE_COMPUTATION_METHODS.map((method) => (
              <div
                key={method.family}
                className={`rounded-2xl border px-4 py-3 text-sm transition-all ${
                  method.family === displayChartFamily
                    ? 'border-purple-400 bg-purple-50/80 text-purple-950 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-100 shadow-sm'
                    : 'border-black/5 bg-black/[0.02] text-slate-700 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-300'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {method.family === displayChartFamily ? (
                    <span className="h-2 w-2 rounded-full bg-purple-600" />
                  ) : null}
                  <span>
                    {DISPLAY_CHART_OPTIONS.find((option) => option.value === method.family)?.label ?? method.family}
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">{method.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Industry References & Standards */}
        <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Industry Standards &amp; Anthropometric Sources
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {SIZE_CHART_SOURCES.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-black/5 bg-black/[0.02] px-4 py-3 transition-all hover:border-purple-300 hover:bg-purple-50/50 dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-purple-500/30 dark:hover:bg-purple-500/10"
              >
                <div className="font-semibold text-slate-900 dark:text-white">{source.label}</div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{source.note}</p>
                <div className="mt-2 text-[11px] font-medium text-purple-600 dark:text-purple-400 truncate">{source.url}</div>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SizeChartsPage;

import React, { useEffect, useMemo, useState } from 'react';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import { MeasurementPointsApi } from '@/api/MeasurementPointsApi';
import UniversalSelect from '@/components/forms/UniversalSelect';
import type { MeasurementPoint } from '@/types/sizing';
import {
  DISPLAY_CHART_OPTIONS,
  MEN_ALPHA_ROWS,
  SIZE_CHART_SOURCES,
  SIZE_COMPUTATION_METHODS,
  WOMEN_ALPHA_ROWS,
  type AlphaDisplayRow,
} from '@/lib/sizeCharts';

const ACTIVE_COLUMN_LABEL: Record<CustomOrderChartFamily, string> = {
  UK: 'uk',
  US: 'us',
  NIGERIA: 'nigeria',
  HYBRID_UK_NIGERIA: 'uk',
  HYBRID_US_NIGERIA: 'us',
  ASIA: 'alpha',
};

const ACTIVE_CHART_EXPLANATION: Record<CustomOrderChartFamily, string> = {
  UK: 'UK display uses UK labels directly.',
  US: 'US display uses US labels directly.',
  NIGERIA: 'Nigeria display uses Nigeria-market labels directly.',
  HYBRID_UK_NIGERIA: 'UK-Nigeria hybrid keeps UK-facing labels, but the stricter UK or Nigeria fit band drives the recommendation.',
  HYBRID_US_NIGERIA: 'US-Nigeria hybrid keeps US-facing labels, but the stricter US or Nigeria fit band drives the recommendation.',
  ASIA: 'Asia display keeps alpha sizing as the visible reference while body measurements still remain the source of truth.',
};

const groupMeasurementPoints = (points: MeasurementPoint[]) =>
  points.reduce<Record<string, MeasurementPoint[]>>((accumulator, point) => {
    const key = point.category || 'GENERAL';
    accumulator[key] ??= [];
    accumulator[key].push(point);
    return accumulator;
  }, {});

const formatCategory = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRange = (point: MeasurementPoint) => {
  if (point.minValueCm == null && point.maxValueCm == null) return 'Use brand guidance';
  if (point.minValueCm != null && point.maxValueCm != null) return `${point.minValueCm}-${point.maxValueCm} cm`;
  if (point.minValueCm != null) return `${point.minValueCm}+ cm`;
  return `Up to ${point.maxValueCm} cm`;
};

const SizeTable: React.FC<{
  title: string;
  rows: AlphaDisplayRow[];
  displayChartFamily: CustomOrderChartFamily;
}> = ({ title, rows, displayChartFamily }) => {
  const activeColumn = ACTIVE_COLUMN_LABEL[displayChartFamily];

  const cellClassName = (column: string) =>
    column === activeColumn
      ? 'text-indigo-700 dark:text-indigo-300 font-semibold'
      : 'text-slate-700 dark:text-slate-300';

  return (
    <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ACTIVE_CHART_EXPLANATION[displayChartFamily]}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th className="py-2 pr-4 font-medium">Alpha</th>
              <th className="py-2 pr-4 font-medium">UK</th>
              <th className="py-2 pr-4 font-medium">US</th>
              <th className="py-2 pr-4 font-medium">EU</th>
              <th className="py-2 pr-4 font-medium">Nigeria</th>
              <th className="py-2 pr-4 font-medium">Bust/Chest</th>
              <th className="py-2 pr-4 font-medium">Waist</th>
              <th className="py-2 pr-4 font-medium">Hip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.alpha}`} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                <td className="py-2 pr-4 font-semibold text-slate-900 dark:text-slate-100">{row.alpha}</td>
                <td className={`py-2 pr-4 ${cellClassName('uk')}`}>{row.uk}</td>
                <td className={`py-2 pr-4 ${cellClassName('us')}`}>{row.us}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.eu}</td>
                <td className={`py-2 pr-4 ${cellClassName('nigeria')}`}>{row.nigeria}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.bust}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.waist}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.hips}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const MeasurementGroup: React.FC<{ title: string; points: MeasurementPoint[] }> = ({ title, points }) => (
  <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {Object.entries(groupMeasurementPoints(points)).map(([category, entries]) => (
        <div key={category} className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 dark:border-white/5 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {formatCategory(category)}
          </div>
          <ul className="mt-3 space-y-2">
            {entries.map((point) => (
              <li key={point.id} className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">{point.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {point.description || 'Measure against the body with the tape level.'} Range: {formatRange(point)}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </section>
);

const SizeChartsPage: React.FC = () => {
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [womenPoints, setWomenPoints] = useState<MeasurementPoint[]>([]);
  const [menPoints, setMenPoints] = useState<MeasurementPoint[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [preference, women, men] = await Promise.all([
          customOrdersBuyerApi.getDisplayChartPreference().catch(() => ({ displayChartFamily: 'UK' as CustomOrderChartFamily, updatedAtMs: Date.now() })),
          MeasurementPointsApi.getAll({ gender: 'WOMEN' }),
          MeasurementPointsApi.getAll({ gender: 'MEN' }),
        ]);

        if (!active) return;
        setDisplayChartFamily(preference.displayChartFamily);
        setWomenPoints(women);
        setMenPoints(men);
      } catch {
        if (!active) return;
        setWomenPoints([]);
        setMenPoints([]);
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

  return (
    <div className="min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <header className="rounded-[2rem] border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <h1 className="text-2xl font-bold md:text-3xl">Size charts and measurement reference</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600 dark:text-slate-300">
            This page now follows the saved display preference live. The tables update immediately when you switch between UK, US, Nigeria, UK-Nigeria hybrid, and US-Nigeria hybrid references, while the measurement prompts stay anchored to the approved point catalog used by custom orders.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <UniversalSelect
              label="Display chart preference"
              value={displayChartFamily}
              onChange={(value) => handleChartPreferenceChange(value as CustomOrderChartFamily)}
              options={DISPLAY_CHART_OPTIONS}
            />
            <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
              <div className="font-semibold">Active chart: {activeDisplayLabel}</div>
              <p className="mt-1">
                Switching here updates chart labels in real time and keeps the custom-order composer aligned with the same display family.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6">
          <SizeTable title="Women Alpha Conversion" rows={WOMEN_ALPHA_ROWS} displayChartFamily={displayChartFamily} />
          <SizeTable title="Men Alpha Conversion" rows={MEN_ALPHA_ROWS} displayChartFamily={displayChartFamily} />

          <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Computation methods by preference</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {SIZE_COMPUTATION_METHODS.map((method) => (
                <div
                  key={method.family}
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    method.family === displayChartFamily
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100'
                      : 'border-black/5 bg-black/[0.02] text-slate-700 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-300'
                  }`}
                >
                  <div className="font-semibold">{DISPLAY_CHART_OPTIONS.find((option) => option.value === method.family)?.label ?? method.family}</div>
                  <p className="mt-1">{method.description}</p>
                </div>
              ))}
            </div>
          </section>

          <MeasurementGroup title="Women measurement points used by the system" points={womenPoints} />
          <MeasurementGroup title="Men measurement points used by the system" points={menPoints} />

          <section className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Live sources used for chart references</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {SIZE_CHART_SOURCES.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-black/5 bg-black/[0.02] px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{source.label}</div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{source.note}</p>
                  <div className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-300">{source.url}</div>
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default SizeChartsPage;

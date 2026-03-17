import React, { useEffect, useMemo, useState } from 'react';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import UniversalSelect from '@/components/forms/UniversalSelect';

type ChartRow = {
  alpha: string;
  us: string;
  uk: string;
  eu: string;
};

const WOMENS_ALPHA_CHART: ChartRow[] = [
  { alpha: 'XS', us: '2-4', uk: '6-8', eu: '34-36' },
  { alpha: 'S', us: '4-6', uk: '8-10', eu: '36-38' },
  { alpha: 'M', us: '8-10', uk: '12-14', eu: '40-42' },
  { alpha: 'L', us: '12-14', uk: '16-18', eu: '44-46' },
  { alpha: 'XL', us: '16-18', uk: '20-22', eu: '48-50' },
  { alpha: 'XXL', us: '20', uk: '24', eu: '52' },
];

const MENS_ALPHA_CHART: ChartRow[] = [
  { alpha: 'XS', us: '34', uk: '34', eu: '44' },
  { alpha: 'S', us: '36', uk: '36', eu: '46' },
  { alpha: 'M', us: '38-40', uk: '38-40', eu: '48-50' },
  { alpha: 'L', us: '42', uk: '42', eu: '52' },
  { alpha: 'XL', us: '44-46', uk: '44-46', eu: '54-56' },
  { alpha: 'XXL', us: '48', uk: '48', eu: '58' },
];

const MEASUREMENT_GUIDE = [
  {
    key: 'Chest/Bust',
    description: 'Measure around the fullest part of your chest while the tape stays level.',
  },
  {
    key: 'Waist',
    description: 'Measure at your natural waistline (usually the narrowest point of your torso).',
  },
  {
    key: 'Hip',
    description: 'Measure around the fullest part of your hips and seat.',
  },
  {
    key: 'Inseam',
    description: 'Measure from the crotch seam down to your desired trouser length.',
  },
  {
    key: 'Sleeve',
    description: 'Measure from shoulder edge to wrist with your arm slightly bent.',
  },
];

const SizeTable: React.FC<{ title: string; rows: ChartRow[] }> = ({ title, rows }) => {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4 md:p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">Alpha</th>
              <th className="py-2 pr-4 font-medium">US</th>
              <th className="py-2 pr-4 font-medium">UK</th>
              <th className="py-2 pr-4 font-medium">EU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${title}-${row.alpha}`}
                className="border-b border-black/5 dark:border-white/5 last:border-b-0"
              >
                <td className="py-2 pr-4 text-slate-900 dark:text-slate-100 font-medium">{row.alpha}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.us}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.uk}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.eu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const SizeChartsPage: React.FC = () => {
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');

  useEffect(() => {
    let active = true;
    void customOrdersBuyerApi
      .getDisplayChartPreference()
      .then((result) => {
        if (active) {
          setDisplayChartFamily(result.displayChartFamily);
        }
      })
      .catch(() => {
        // Keep default when auth/preference is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const activeChartTitle = useMemo(() => {
    if (displayChartFamily === 'NIGERIA') return 'Nigeria';
    if (displayChartFamily === 'US') return 'US';
    if (displayChartFamily === 'ASIA') return 'Asia';
    return 'UK';
  }, [displayChartFamily]);

  const handleChartPreferenceChange = (next: CustomOrderChartFamily) => {
    setDisplayChartFamily(next);
    void customOrdersBuyerApi.updateDisplayChartPreference({
      displayChartFamily: next,
      updatedAtMs: Date.now(),
    });
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Size Charts</h1>
          <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
            Use this reference to convert common size systems and take measurements consistently before placing RTW or custom-fit orders.
          </p>
          <div className="mt-4 max-w-[280px]">
            <UniversalSelect
              label="Display chart preference"
              value={displayChartFamily}
              onChange={(value) => handleChartPreferenceChange(value as CustomOrderChartFamily)}
              options={[
                { value: 'UK', label: 'UK' },
                { value: 'US', label: 'US' },
                { value: 'NIGERIA', label: 'Nigeria' },
                { value: 'ASIA', label: 'Asia' },
              ]}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Active display chart: {activeChartTitle}. This preference updates custom-order composer labels only and does not alter locked order pricing snapshots.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          <SizeTable title="Women — Alpha Conversion" rows={WOMENS_ALPHA_CHART} />
          <SizeTable title="Men — Alpha Conversion" rows={MENS_ALPHA_CHART} />

          <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4 md:p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Measurement Guide
            </h2>
            <ul className="mt-3 space-y-2">
              {MEASUREMENT_GUIDE.map((item) => (
                <li key={item.key} className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.key}:</span>{' '}
                  {item.description}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default SizeChartsPage;

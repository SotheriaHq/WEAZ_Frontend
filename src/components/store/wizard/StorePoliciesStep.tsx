import React, { useCallback, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  RotateCcw,
  Ruler,
  Clock,
  Upload,
  Sparkles,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';
import type { StoreWizardData } from '@/types/storeWizard';
import MediaRenderer from '@/components/media/MediaRenderer';

interface StorePoliciesStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

// Shipping regions with flags (Africa-first)
const SHIPPING_COUNTRIES = [
  { value: 'nigeria', label: 'Nigeria', flag: '🇳🇬', accent: 'from-emerald-500/20 to-emerald-600/20' },
  { value: 'ghana', label: 'Ghana', flag: '🇬🇭', accent: 'from-amber-500/20 to-red-500/20' },
  { value: 'kenya', label: 'Kenya', flag: '🇰🇪', accent: 'from-green-500/20 to-red-500/20' },
  { value: 'south-africa', label: 'South Africa', flag: '🇿🇦', accent: 'from-cyan-500/20 to-emerald-500/20' },
  { value: 'rwanda', label: 'Rwanda', flag: '🇷🇼', accent: 'from-yellow-500/20 to-blue-500/20' },
  { value: 'egypt', label: 'Egypt', flag: '🇪🇬', accent: 'from-red-500/20 to-gray-500/20' },
  { value: 'uk', label: 'United Kingdom', flag: '🇬🇧', accent: 'from-blue-500/20 to-red-500/20' },
  { value: 'us', label: 'United States', flag: '🇺🇸', accent: 'from-blue-500/20 to-indigo-500/20' },
  { value: 'international', label: 'International', flag: '🌍', accent: 'from-purple-500/20 to-blue-500/20' },
];

// Processing times
const PROCESSING_TIMES = [
  { value: '1-2', label: '1-2 business days' },
  { value: '3-5', label: '3-5 business days' },
  { value: '5-7', label: '5-7 business days' },
  { value: '7-14', label: '7-14 business days' },
];

// Shipping methods
const SHIPPING_METHODS = [
  { value: 'standard', label: 'Standard Shipping' },
  { value: 'express', label: 'Express Shipping' },
  { value: 'free-threshold', label: 'Free over threshold' },
];

// Return windows
const RETURN_WINDOWS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: 'none', label: 'No returns' },
];

// Return conditions
const RETURN_CONDITIONS = [
  { value: 'unworn', label: 'Unworn with tags attached' },
  { value: 'original-packaging', label: 'Original packaging required' },
  { value: 'receipt', label: 'Receipt/proof of purchase' },
  { value: 'undamaged', label: 'Undamaged condition' },
];

const SIZE_CHARTS = [
  {
    id: 'africa-west-south',
    title: 'West/South Africa (NG/ZA)',
    description: 'Ready-to-wear cuts commonly used by Lagos/Johannesburg ateliers',
    rows: [
      { size: 'XS', bust: '32-33 in / 81-84 cm', waist: '25-26 in / 64-66 cm', hip: '35-36 in / 89-92 cm' },
      { size: 'S', bust: '34-35 in / 86-89 cm', waist: '27-28 in / 69-71 cm', hip: '37-38 in / 94-97 cm' },
      { size: 'M', bust: '36-37 in / 91-94 cm', waist: '29-30 in / 74-76 cm', hip: '39-40 in / 99-102 cm' },
      { size: 'L', bust: '38-40 in / 97-102 cm', waist: '31-33 in / 79-84 cm', hip: '41-43 in / 104-109 cm' },
      { size: 'XL', bust: '41-43 in / 104-109 cm', waist: '34-36 in / 86-91 cm', hip: '44-46 in / 112-117 cm' },
    ],
  },
  {
    id: 'uk-eu',
    title: 'UK/EU Conversion',
    description: 'UK numeric sizes mapped to EU; works for shoppers in London, Berlin, Paris',
    rows: [
      { size: 'UK 6 / EU 34', bust: '32-33 in / 81-84 cm', waist: '25-26 in / 64-66 cm', hip: '35-36 in / 89-92 cm' },
      { size: 'UK 8 / EU 36', bust: '34-35 in / 86-89 cm', waist: '27-28 in / 69-71 cm', hip: '37-38 in / 94-97 cm' },
      { size: 'UK 10 / EU 38', bust: '36-37 in / 91-94 cm', waist: '29-30 in / 74-76 cm', hip: '39-40 in / 99-102 cm' },
      { size: 'UK 12 / EU 40', bust: '38-40 in / 97-102 cm', waist: '31-33 in / 79-84 cm', hip: '41-43 in / 104-109 cm' },
      { size: 'UK 14 / EU 42', bust: '41-43 in / 104-109 cm', waist: '34-36 in / 86-91 cm', hip: '44-46 in / 112-117 cm' },
    ],
  },
  {
    id: 'us',
    title: 'US Contemporary',
    description: 'Clean US alpha-to-numeric mapping for international buyers',
    rows: [
      { size: 'US 0-2 / XS', bust: '32-33 in / 81-84 cm', waist: '25-26 in / 64-66 cm', hip: '35-36 in / 89-92 cm' },
      { size: 'US 4-6 / S', bust: '34-35 in / 86-89 cm', waist: '27-28 in / 69-71 cm', hip: '37-38 in / 94-97 cm' },
      { size: 'US 8 / M', bust: '36-37 in / 91-94 cm', waist: '29-30 in / 74-76 cm', hip: '39-40 in / 99-102 cm' },
      { size: 'US 10 / L', bust: '38-40 in / 97-102 cm', waist: '31-33 in / 79-84 cm', hip: '41-43 in / 104-109 cm' },
      { size: 'US 12-14 / XL', bust: '41-43 in / 104-109 cm', waist: '34-36 in / 86-91 cm', hip: '44-46 in / 112-117 cm' },
    ],
  },
];

// Refund methods
const REFUND_METHODS = [
  { value: 'original', label: 'Original payment method' },
  { value: 'store-credit', label: 'Store credit' },
  { value: 'exchange', label: 'Exchange only' },
];

// Response time SLAs
const RESPONSE_SLAS = [
  { value: '2h', label: 'Within 2 hours' },
  { value: 'same-day', label: 'Same business day' },
  { value: '24h', label: 'Within 24 hours' },
  { value: '48h', label: 'Within 48 hours' },
];

// Recommended defaults
const RECOMMENDED_DEFAULTS: Partial<StoreWizardData> = {
  shippingRegions: ['nigeria'],
  processingTime: '3-5',
  shippingMethods: ['standard', 'express'],
  freeShippingThreshold: 50000,
  returnsAccepted: true,
  returnWindow: '14',
  returnConditions: ['unworn', 'original-packaging'],
  refundMethod: 'original',
  responseTimeSla: '24h',
};

/**
 * Store Policies Step (Screen 1.4)
 * Step 3 of 4: Configure shipping, returns, and contact policies
 */
const StorePoliciesStep: React.FC<StorePoliciesStepProps> = ({
  data,
  onChange,
  onBack,
  onContinue,
  isSaving = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Accordion state for collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    shipping: true,
    returns: true,
    sizeChart: false, // Collapsed by default - less clutter
    contact: true,
  });
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Toggle region selection
  const toggleRegion = useCallback(
    (region: string) => {
      if (data.shippingRegions.includes(region)) {
        onChange({
          shippingRegions: data.shippingRegions.filter((r) => r !== region),
        });
      } else {
        onChange({ shippingRegions: [...data.shippingRegions, region] });
      }
    },
    [data.shippingRegions, onChange]
  );

  // Toggle shipping method
  const toggleShippingMethod = useCallback(
    (method: string) => {
      if (data.shippingMethods.includes(method)) {
        onChange({
          shippingMethods: data.shippingMethods.filter((m) => m !== method),
        });
      } else {
        onChange({ shippingMethods: [...data.shippingMethods, method] });
      }
    },
    [data.shippingMethods, onChange]
  );

  // Toggle return condition
  const toggleReturnCondition = useCallback(
    (condition: string) => {
      if (data.returnConditions.includes(condition)) {
        onChange({
          returnConditions: data.returnConditions.filter((c) => c !== condition),
        });
      } else {
        onChange({ returnConditions: [...data.returnConditions, condition] });
      }
    },
    [data.returnConditions, onChange]
  );

  // Apply recommended defaults
  const applyDefaults = useCallback(() => {
    onChange(RECOMMENDED_DEFAULTS);
  }, [onChange]);

  // Handle size chart upload
  const handleSizeChartUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          onChange({
            sizeChartFile: file,
            sizeChartUrl: event.target?.result as string,
            sizeChartPresetKey: null,
            sizeChartSystem: 'custom',
          });
        };
        reader.readAsDataURL(file);
      }
    },
    [onChange]
  );

  const selectedPreset = SIZE_CHARTS.find(
    (chart) => chart.id === data.sizeChartPresetKey
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Main Content - Centered Card */}
      <div className="flex-1 flex items-start justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[900px]">
          {/* Glass Card Container */}
          <div className="rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10 shadow-xl">
            {/* Step Progress Header */}
            <div className="px-8 pt-8 pb-4 border-b border-gray-200/50 dark:border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-bold border border-purple-500/30">
                    3
                  </div>
                  <span className="text-gray-900 dark:text-white font-medium">
                    Store Policies
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Step 3 of 4
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-blue-500 w-1/2 rounded-full transition-all duration-500" />
              </div>
            </div>

            {/* Content Area */}
            <div className="p-8 space-y-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Set Your Policies
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
                    Define how you handle shipping, returns, and customer
                    inquiries.
                  </p>
                </div>
                <button
                  onClick={applyDefaults}
                  className="px-4 py-2 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Apply Recommended
                </button>
              </div>

              {/* Policy Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Shipping Policy Card */}
                <div className="rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Package className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Shipping Policy
                    </h3>
                  </div>

                  {/* Shipping Regions */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Shipping Regions
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SHIPPING_COUNTRIES.map((region) => {
                        const isSelected = data.shippingRegions.includes(region.value);
                        const isAfrican = ['nigeria', 'ghana', 'kenya', 'south-africa', 'rwanda', 'egypt'].includes(region.value);
                        return (
                          <button
                            key={region.value}
                            onClick={() => toggleRegion(region.value)}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-200 bg-gradient-to-r ${region.accent} ${
                              isSelected
                                ? 'border-purple-500/50 shadow-lg shadow-purple-500/10'
                                : 'border-gray-200 dark:border-white/10 hover:border-purple-400/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl" aria-hidden="true">{region.flag}</span>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {region.label}
                                </span>
                                <span className="text-[11px] text-gray-600 dark:text-gray-400">
                                  {isAfrican ? 'Africa-first lane' : 'Secondary lane'}
                                </span>
                              </div>
                            </div>
                            <div
                              className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white/70 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-700'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Processing Time */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Processing Time
                    </label>
                    <select
                      value={data.processingTime}
                      onChange={(e) =>
                        onChange({ processingTime: e.target.value })
                      }
                      className="select-threadly w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select processing time</option>
                      {PROCESSING_TIMES.map((time) => (
                        <option key={time.value} value={time.value}>
                          {time.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Shipping Methods */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Shipping Methods
                    </label>
                    <div className="space-y-2">
                      {SHIPPING_METHODS.map((method) => {
                        const isSelected = data.shippingMethods.includes(
                          method.value
                        );
                        return (
                          <label
                            key={method.value}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleShippingMethod(method.value)}
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {method.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Free Shipping Threshold */}
                  {data.shippingMethods.includes('free-threshold') && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Free Shipping Threshold (₦)
                      </label>
                      <input
                        type="number"
                        value={data.freeShippingThreshold || ''}
                        onChange={(e) =>
                          onChange({
                            freeShippingThreshold: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        placeholder="e.g. 50000"
                        className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>

                {/* Returns Policy Card */}
                <div className="rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Returns & Exchanges
                      </h3>
                    </div>
                    {/* Returns Toggle */}
                    <button
                      onClick={() =>
                        onChange({ returnsAccepted: !data.returnsAccepted })
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        data.returnsAccepted
                          ? 'bg-purple-600'
                          : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          data.returnsAccepted ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {data.returnsAccepted ? (
                    <>
                      {/* Return Window */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Return Window
                        </label>
                        <select
                          value={data.returnWindow}
                          onChange={(e) =>
                            onChange({ returnWindow: e.target.value })
                          }
                          className="select-threadly w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                        >
                          {RETURN_WINDOWS.filter((w) => w.value !== 'none').map(
                            (window) => (
                              <option key={window.value} value={window.value}>
                                {window.label}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* Return Conditions */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Conditions
                        </label>
                        <div className="space-y-2">
                          {RETURN_CONDITIONS.map((condition) => {
                            const isSelected = data.returnConditions.includes(
                              condition.value
                            );
                            return (
                              <label
                                key={condition.value}
                                className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleReturnCondition(condition.value)
                                  }
                                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {condition.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Refund Method */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Refund Method
                        </label>
                        <select
                          value={data.refundMethod}
                          onChange={(e) =>
                            onChange({ refundMethod: e.target.value })
                          }
                          className="select-threadly w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                        >
                          {REFUND_METHODS.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">
                        Returns are disabled. Toggle above to enable.
                      </p>
                    </div>
                  )}
                </div>

                {/* Size Chart Card - Collapsible */}
                <div className="rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 p-6 space-y-4">
                  <button
                    type="button"
                    onClick={() => toggleSection('sizeChart')}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                        <Ruler className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Size Chart
                        </h3>
                        <p className="text-xs text-gray-500">
                          {data.sizeChartPresetKey ? `Using ${data.sizeChartPresetKey}` : 'Tap to configure'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.sizeChart ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedSections.sizeChart && (
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {/* Preset cards */}
                    <div className="space-y-3">
                      {SIZE_CHARTS.map((chart, index) => {
                        const isActive = data.sizeChartPresetKey === chart.id;
                        const isAfrica = chart.id === 'africa-west-south';
                        return (
                          <button
                            key={chart.id}
                            onClick={() =>
                              onChange({
                                sizeChartPresetKey: chart.id,
                                sizeChartSystem: chart.id,
                                sizeChartFile: null,
                                sizeChartUrl: null,
                              })
                            }
                            className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-200 bg-white dark:bg-black/20 hover:border-purple-400/60 hover:shadow-md ${
                              isActive
                                ? 'border-purple-500/60 shadow-purple-500/15 shadow-lg'
                                : 'border-gray-200 dark:border-white/10'
                            } ${isAfrica ? 'ring-1 ring-emerald-400/40' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {chart.title}
                                  </span>
                                  {isAfrica && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {chart.description}
                                </p>
                              </div>
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                                  isActive
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-400'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                              <span>{index === 0 ? 'Africa-first sizing lane' : 'Mapped for cross-border shoppers'}</span>
                            </div>
                          </button>
                        );
                      })}
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Or upload custom image
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSizeChartUpload}
                        />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/10 bg-white dark:bg-black/10 p-4 h-full">
                      {data.sizeChartUrl ? (
                        <div className="relative">
                          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-gray-200/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-300/60 dark:border-white/10">Custom upload</span>
                            <span>Preview</span>
                          </div>
                          <MediaRenderer
                            kind="image"
                            src={data.sizeChartUrl}
                            alt="Size chart preview"
                            maxHeightClassName="max-h-40"
                            className="rounded-lg border border-gray-200 dark:border-white/10"
                            mediaClassName="rounded-lg"
                          />
                          <button
                            onClick={() =>
                              onChange({ sizeChartFile: null, sizeChartUrl: null })
                            }
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : selectedPreset ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="px-2 py-0.5 rounded-full bg-purple-600/10 text-purple-700 dark:text-purple-200 border border-purple-500/20">
                                {selectedPreset.title}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">Preview</span>
                            </div>
                          </div>
                          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                            <table className="min-w-full text-xs text-left text-gray-700 dark:text-gray-200">
                              <thead className="bg-gray-100 dark:bg-white/5 text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                <tr>
                                  <th className="px-3 py-2">Size</th>
                                  <th className="px-3 py-2">Bust</th>
                                  <th className="px-3 py-2">Waist</th>
                                  <th className="px-3 py-2">Hip</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPreset.rows.map((row) => (
                                  <tr key={row.size} className="odd:bg-white even:bg-gray-50 dark:odd:bg-black/30 dark:even:bg-black/20">
                                    <td className="px-3 py-2 font-medium">{row.size}</td>
                                    <td className="px-3 py-2">{row.bust}</td>
                                    <td className="px-3 py-2">{row.waist}</td>
                                    <td className="px-3 py-2">{row.hip}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center text-sm text-gray-500 gap-2">
                          <Sparkles className="w-6 h-6 text-purple-500" />
                          <p>Select a preset to preview or upload a custom chart.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>

                {/* Customer Contact Card */}
                <div className="rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Customer Contact
                    </h3>
                  </div>

                  {/* Response Time SLA */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Response Time Commitment
                    </label>
                    <select
                      value={data.responseTimeSla}
                      onChange={(e) =>
                        onChange({ responseTimeSla: e.target.value })
                      }
                      className="select-threadly w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                    >
                      {RESPONSE_SLAS.map((sla) => (
                        <option key={sla.value} value={sla.value}>
                          {sla.label}
                        </option>
                      ))}
                    </select>
                    {/* Preview badge */}
                    <div className="p-3 rounded-lg bg-purple-600/5 border border-purple-500/20">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-gray-700 dark:text-gray-300">
                          Badge: "Usually responds{' '}
                          {
                            RESPONSE_SLAS.find(
                              (s) => s.value === data.responseTimeSla
                            )?.label.toLowerCase() || 'within 24 hours'
                          }
                          "
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={data.contactEmail}
                      onChange={(e) =>
                        onChange({ contactEmail: e.target.value })
                      }
                      placeholder="support@yourbrand.com"
                      className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-black/20">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Progress</span>
                  <span className="text-purple-600 font-medium">Step 3 of 4</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-purple-700 h-full rounded-full transition-all duration-300"
                    style={{ width: '50%' }}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={onBack}
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-sm inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={onContinue}
                  disabled={isSaving}
                  className="px-8 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorePoliciesStep;

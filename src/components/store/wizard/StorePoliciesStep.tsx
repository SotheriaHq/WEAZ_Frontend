import React, { useCallback } from 'react';
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
} from 'lucide-react';
import type { StoreWizardData } from '@/pages/store/StoreCreationWizard';

interface StorePoliciesStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

// Shipping regions
const SHIPPING_REGIONS = [
  { value: 'nigeria', label: 'Nigeria' },
  { value: 'ghana', label: 'Ghana' },
  { value: 'kenya', label: 'Kenya' },
  { value: 'south-africa', label: 'South Africa' },
  { value: 'other-africa', label: 'Other Africa' },
  { value: 'international', label: 'International' },
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
 * Step 3 of 6: Configure shipping, returns, and contact policies
 */
const StorePoliciesStep: React.FC<StorePoliciesStepProps> = ({
  data,
  onChange,
  onBack,
  onContinue,
  isSaving = false,
}) => {
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
          });
        };
        reader.readAsDataURL(file);
      }
    },
    [onChange]
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
                  Step 3 of 6
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
                    <div className="flex flex-wrap gap-2">
                      {SHIPPING_REGIONS.map((region) => {
                        const isSelected = data.shippingRegions.includes(
                          region.value
                        );
                        return (
                          <button
                            key={region.value}
                            onClick={() => toggleRegion(region.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3 h-3 inline mr-1" />
                            )}
                            {region.label}
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
                      className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
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
                          className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
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
                          className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
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

                {/* Size Chart Card */}
                <div className="rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                      <Ruler className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Size Chart
                      </h3>
                      <p className="text-xs text-gray-500">
                        Optional but recommended
                      </p>
                    </div>
                  </div>

                  {data.sizeChartUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                      <img
                        src={data.sizeChartUrl}
                        alt="Size chart preview"
                        className="w-full h-32 object-contain bg-white dark:bg-black/20"
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
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-500/5 transition-all">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Upload size chart image
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        PNG, JPG up to 2MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleSizeChartUpload}
                      />
                    </label>
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
                      className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
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
                  <span className="text-purple-600 font-medium">Step 3 of 6</span>
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

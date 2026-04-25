import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import { MeasurementPointsApi } from '@/api/MeasurementPointsApi';
import { useMeasurementPoints } from '@/hooks/useMeasurementPoints';
import type {
  MeasurementPoint,
  MeasurementPointCategory,
  SizingMode,
} from '@/types/sizing';
import { isCustomSizingMode, isRtwSizingMode } from '@/types/sizing';

interface SizingConfiguratorProps {
  sizingMode: SizingMode;
  onSizingModeChange: (value: SizingMode) => void;
  rtwSizeSystem?: string;
  onRtwSizeSystemChange: (value: string) => void;
  customMeasurementKeys: string[];
  onCustomMeasurementKeysChange: (keys: string[]) => void;
  measurementGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  disabled?: boolean;
}

const SIZE_SYSTEM_OPTIONS = ['ALPHA', 'US', 'UK', 'EU', 'IT', 'FR', 'AU', 'JP', 'KR'];
const CATEGORY_OPTIONS: MeasurementPointCategory[] = [
  'UPPER_BODY',
  'ARMS',
  'LOWER_BODY',
  'LENGTH',
  'GENERAL',
  'ACCESSORIES',
];

export const SizingConfigurator: React.FC<SizingConfiguratorProps> = ({
  sizingMode,
  onSizingModeChange,
  rtwSizeSystem,
  onRtwSizeSystemChange,
  customMeasurementKeys,
  onCustomMeasurementKeysChange,
  measurementGender,
  disabled = false,
}) => {
  const measurementFilter = useMemo(
    () => (measurementGender ? { gender: measurementGender } : undefined),
    [measurementGender],
  );
  const { points, isLoading } = useMeasurementPoints(measurementFilter);
  const [freeformLabel, setFreeformLabel] = useState('');
  const [freeformDescription, setFreeformDescription] = useState('');
  const [freeformCategory, setFreeformCategory] =
    useState<MeasurementPointCategory>('GENERAL');
  const [isSubmittingFreeform, setIsSubmittingFreeform] = useState(false);
  const [addedPoints, setAddedPoints] = useState<MeasurementPoint[]>([]);
  const [showAllPoints, setShowAllPoints] = useState(false);
  const selectedKeys = customMeasurementKeys;

  const INITIAL_DISPLAY_COUNT = 12;

  const syncSelectedKeys = (nextKeys: string[]) => {
    onCustomMeasurementKeysChange(nextKeys);
  };

  const toggleMeasurementKey = (key: string) => {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((existing) => existing !== key)
      : [...selectedKeys, key];
    syncSelectedKeys(next);
  };

  const mergedPoints = useMemo(() => {
    const byKey = new Map<string, MeasurementPoint>();
    const seenLabels = new Set<string>();
    for (const point of points) {
      const normalizedLabel = point.label.trim().toLowerCase();
      if (seenLabels.has(normalizedLabel)) continue;
      seenLabels.add(normalizedLabel);
      byKey.set(point.key, point);
    }
    for (const point of addedPoints) {
      const normalizedLabel = point.label.trim().toLowerCase();
      if (seenLabels.has(normalizedLabel)) continue;
      seenLabels.add(normalizedLabel);
      byKey.set(point.key, point);
    }
    return Array.from(byKey.values());
  }, [addedPoints, points]);

  /** Points the user has already selected */
  const selectedPoints = useMemo(() => {
    const pointsByKey = new Map(mergedPoints.map((point) => [point.key, point]));
    return selectedKeys.map((key) => {
      const existing = pointsByKey.get(key);
      if (existing) return existing;

      const fallbackLabel = key
        .replace(/^BRAND_[^_]+_/, '')
        .replace(/_/g, ' ')
        .trim();

      return {
        id: key,
        key,
        label: fallbackLabel.length > 0 ? fallbackLabel : key,
        description: null,
        category: 'GENERAL' as MeasurementPointCategory,
        gender: measurementGender ?? null,
        source: 'BRAND_FREEFORM' as const,
        status: 'BRAND_ONLY' as const,
        brandId: null,
        minValueCm: null,
        maxValueCm: null,
        minValueChildCm: null,
        maxValueChildCm: null,
        sortOrder: 999,
        isActive: true,
      } as MeasurementPoint;
    });
  }, [mergedPoints, selectedKeys, measurementGender]);

  /** Points the user has NOT yet selected — shown as available chips */
  const unselectedPoints = useMemo(
    () => mergedPoints.filter((p) => !selectedKeys.includes(p.key)),
    [mergedPoints, selectedKeys],
  );

  const handleAddFreeformPoint = async () => {
    const label = freeformLabel.trim();
    const description = freeformDescription.trim();

    if (!label) {
      toast.error('Enter a measurement label');
      return;
    }

    // Client-side duplicate check
    const existing = mergedPoints.find(
      (p) => p.label.trim().toLowerCase() === label.toLowerCase(),
    );
    if (existing) {
      // Auto-select the existing point instead of showing an error
      if (!selectedKeys.includes(existing.key)) {
        syncSelectedKeys([...selectedKeys, existing.key]);
        toast.info(`"${existing.label}" already exists — selected it for you`);
      } else {
        toast.info(`"${existing.label}" is already selected`);
      }
      setFreeformLabel('');
      return;
    }

    setIsSubmittingFreeform(true);
    try {
      const response = await MeasurementPointsApi.submitFreeform({
        label,
        description: description || undefined,
        category: freeformCategory,
        gender: measurementGender,
      });

      setAddedPoints((prev) => {
        if (prev.some((point) => point.key === response.point.key)) return prev;
        return [...prev, response.point];
      });

      if (!selectedKeys.includes(response.point.key)) {
        syncSelectedKeys([...selectedKeys, response.point.key]);
      }

      setFreeformLabel('');
      setFreeformDescription('');
      setFreeformCategory('GENERAL');

      toast.success('Custom measurement point added');
    } catch (error: any) {
      const message =
        typeof error?.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Failed to add custom measurement point';
      toast.error(message);
    } finally {
      setIsSubmittingFreeform(false);
    }
  };

  return (
    <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4 space-y-4">
      <div>
        <h2 className="text-base font-medium text-gray-900 dark:text-white">Sizing</h2>
        <p className="text-xs text-gray-500 mt-1">Custom/Hybrid on products requires buyer measurements at add-to-bag.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
          Product Sizing Mode
        </label>
        <Select
          value={sizingMode}
          onChange={(event) => onSizingModeChange(event.target.value as SizingMode)}
          disabled={disabled}
        >
          <option value="NONE">No Sizing</option>
          <option value="RTW">RTW</option>
          <option value="RTW_PLUS_FITTINGS">RTW + Fittings</option>
        </Select>
      </div>

      {isRtwSizingMode(sizingMode) && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            RTW Size System
          </label>
          <Select
            value={rtwSizeSystem || 'ALPHA'}
            onChange={(event) => onRtwSizeSystemChange(event.target.value)}
            disabled={disabled}
          >
            {SIZE_SYSTEM_OPTIONS.map((system) => (
              <option key={system} value={system}>
                {system}
              </option>
            ))}
          </Select>
        </div>
      )}

      {isCustomSizingMode(sizingMode) && (
        <div className="space-y-3">
          {/* Selected measurement points — compact chips */}
          {selectedPoints.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Selected Points ({selectedPoints.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedPoints.map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => toggleMeasurementKey(point.key)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/60 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 shadow-sm hover:bg-purple-500/20 transition-all"
                  >
                    <span className="truncate max-w-[140px]">{point.label}</span>
                    <span className="text-purple-400 text-[9px]">✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available measurement points — selectable chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Available Points{unselectedPoints.length > 0 && ` (${unselectedPoints.length})`}
            </label>
            <div className="rounded-lg border border-gray-200/70 dark:border-white/10 p-2">
              {isLoading ? (
                <p className="text-xs text-gray-500">Loading measurement points...</p>
              ) : unselectedPoints.length === 0 ? (
                <p className="text-[11px] text-gray-400">All available points are selected</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {(showAllPoints ? unselectedPoints : unselectedPoints.slice(0, INITIAL_DISPLAY_COUNT)).map((point) => (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => toggleMeasurementKey(point.key)}
                        disabled={disabled}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-500/10 dark:hover:text-purple-300 transition-all"
                        title={`Click to select — ${point.label}`}
                      >
                        <span className="truncate max-w-[140px]">{point.label}</span>
                        <span className="text-[9px] text-gray-400">+</span>
                      </button>
                    ))}
                  </div>
                  {unselectedPoints.length > INITIAL_DISPLAY_COUNT && (
                    <button
                      type="button"
                      onClick={() => setShowAllPoints((v) => !v)}
                      className="mt-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {showAllPoints
                        ? 'Show less'
                        : `Show all ${unselectedPoints.length} points (+${unselectedPoints.length - INITIAL_DISPLAY_COUNT} more)`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Add Custom Measurement Point — compact form */}
          <div className="rounded-lg border border-gray-200/70 dark:border-white/10 p-2.5 space-y-2">
            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Add Custom Point
            </p>
            <div className="flex items-center gap-2">
              <input
                value={freeformLabel}
                onChange={(event) => setFreeformLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddFreeformPoint();
                  }
                }}
                disabled={disabled || isSubmittingFreeform}
                placeholder="Label (e.g. Round Sleeve)"
                className="flex-1 min-w-[120px] rounded-lg border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <Select
                value={freeformCategory}
                onChange={(event) =>
                  setFreeformCategory(event.target.value as MeasurementPointCategory)
                }
                disabled={disabled || isSubmittingFreeform}
                fullWidth={false}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={freeformDescription}
                onChange={(event) => setFreeformDescription(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddFreeformPoint();
                  }
                }}
                disabled={disabled || isSubmittingFreeform}
                placeholder="Optional description"
                className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleAddFreeformPoint}
                disabled={disabled || isSubmittingFreeform}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-purple-600 px-3 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60 shrink-0"
              >
                {isSubmittingFreeform ? '...' : 'Add'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">Press Enter to add quickly</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default SizingConfigurator;

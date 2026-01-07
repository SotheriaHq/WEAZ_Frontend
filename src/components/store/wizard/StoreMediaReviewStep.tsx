import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Check,
  X,
  Wand2,
  Crop,
  Upload,
  ZoomIn,
  Lightbulb,
  ChevronRight,
  ImageOff,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StoreWizardData, MediaItem } from '@/types/storeWizard';
import MediaRenderer from '@/components/media/MediaRenderer';

interface StoreMediaReviewStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

// Requirements checklist - dynamically computed
const getRequirements = (mediaItems: MediaItem[]) => {
  const hasMinResolution = mediaItems.every(m => m.status !== 'failed' || !m.issues?.some(i => i.type === 'resolution'));
  const hasEnoughAngles = mediaItems.length >= 3;
  const hasModelShot = mediaItems.some(m => m.name?.toLowerCase().includes('model'));
  const hasGoodQuality = mediaItems.filter(m => m.status === 'passed').length >= mediaItems.length * 0.7;
  const noWatermarks = !mediaItems.some(m => m.issues?.some(i => i.type === 'watermark'));

  return [
    { id: 'resolution', label: 'Min 1200x1200px resolution', status: hasMinResolution ? 'passed' : 'failed' as const },
    { id: 'angles', label: 'At least 3 product angles', status: hasEnoughAngles ? 'passed' : 'warning' as const },
    { id: 'model', label: 'On-model shot included', status: hasModelShot ? 'passed' : 'warning' as const },
    { id: 'quality', label: 'Clear, professional quality', status: hasGoodQuality ? 'passed' : 'warning' as const },
    { id: 'watermark', label: 'No watermarks or overlays', status: noWatermarks ? 'passed' : 'failed' as const },
  ];
};

/**
 * Store Media Review Step (Screen 1.9)
 * Step 5 of 6: Review uploaded media against quality standards
 */
const StoreMediaReviewStep: React.FC<StoreMediaReviewStepProps> = ({
  data,
  onChange,
  onBack,
  onContinue,
  isSaving = false,
}) => {
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [deferredIssues, setDeferredIssues] = useState(false);

  // Build media items from actual product images
  const mediaItems: MediaItem[] = useMemo(() => {
    if (!data.products || data.products.length === 0) {
      return [];
    }
    
    // Extract images from products
    return data.products.map((product, index) => ({
      id: product.id,
      url: product.image,
      name: product.name || `Product ${index + 1}`,
      resolution: '1200 x 1600px', // Placeholder - would be computed from actual image
      status: 'passed',
      issues: [],
    }));
  }, [data.products]);

  const failedCount = mediaItems.filter((m) => m.status === 'failed').length;
  const warningCount = mediaItems.filter((m) => m.status === 'warning').length;
  const issueCount = failedCount + warningCount;
  const allPassed = issueCount === 0;
  const requirements = getRequirements(mediaItems);

  // Can continue if no failed items OR user clicked "Fix Later"
  const canContinue = failedCount === 0 || deferredIssues;

  // Handle Auto-fix All
  const handleAutoFixAll = useCallback(async () => {
    setIsAutoFixing(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mark all warnings as passed
    const fixedMedia = mediaItems.map(item => ({
      ...item,
      status: item.status === 'warning' ? 'passed' as const : item.status,
      issues: item.status === 'warning' ? [] : item.issues,
    }));
    
    onChange({ mediaItems: fixedMedia });
    setIsAutoFixing(false);
    toast.success('Auto-fix complete! Warnings have been resolved.');
  }, [mediaItems, onChange]);

  // Handle Fix Later
  const handleFixLater = useCallback(() => {
    setDeferredIssues(true);
    toast.info('Issues deferred. You can fix them later from your dashboard.');
  }, []);

  // Empty state - no products to review
  if (mediaItems.length === 0) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <ImageOff className="w-10 h-10 text-gray-400 dark:text-white/40" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              No Media to Review
            </h2>
            <p className="text-gray-600 dark:text-white/60 mb-6">
              You haven't added any products with images yet. You can skip this step and add products later from your dashboard.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onBack}
                className="px-6 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Back
              </button>
              <button
                onClick={onContinue}
                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium flex items-center gap-2"
              >
                Skip & Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Media Quality Review
          </h1>
          <p className="text-gray-600 dark:text-white/60">
            We've analyzed your uploads against our marketplace standards to ensure high conversion rates.
          </p>
        </div>

        {/* Status Banner */}
        <div
          className={`bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            allPassed || deferredIssues
              ? 'border-green-500/30 border-l-4 border-l-green-500'
              : 'border-orange-500/30 border-l-4 border-l-orange-500'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                allPassed || deferredIssues ? 'bg-green-500/20' : 'bg-orange-500/20'
              }`}
            >
              {allPassed || deferredIssues ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              )}
            </div>
            <div>
              <h3
                className={`font-semibold text-lg ${
                  allPassed || deferredIssues
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}
              >
                {allPassed
                  ? 'All media passed quality checks'
                  : deferredIssues
                  ? 'Issues deferred - you can fix later'
                  : `${issueCount} item${issueCount > 1 ? 's' : ''} need attention`}
              </h3>
              <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
                {allPassed
                  ? 'Your media meets all marketplace standards.'
                  : deferredIssues
                  ? 'Continue to finish setup. Fix issues from your dashboard.'
                  : "Some images don't meet the minimum resolution or composition requirements."}
              </p>
            </div>
          </div>
          {!allPassed && !deferredIssues && (
            <button
              onClick={handleAutoFixAll}
              disabled={isAutoFixing}
              className="px-4 py-2 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap border border-gray-200 dark:border-white/10 flex items-center gap-2 disabled:opacity-50"
            >
              {isAutoFixing ? (
                <>
                  <Loader2 className="w-4 h-4 text-purple-600 dark:text-indigo-400 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-purple-600 dark:text-indigo-400" />
                  Auto-fix All
                </>
              )}
            </button>
          )}
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border rounded-xl overflow-hidden group hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 ${
                item.status === 'failed'
                  ? 'border-red-500/30'
                  : item.status === 'warning'
                  ? 'border-orange-500/30'
                  : 'border-gray-200 dark:border-white/10'
              }`}
            >
              {/* Image */}
              <div className="relative w-full aspect-[4/3]">
                <MediaRenderer
                  kind="image"
                  src={item.url}
                  alt={item.name}
                  maxHeightClassName="max-h-48"
                  className="w-full h-full object-cover"
                />
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                      item.status === 'passed'
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                        : item.status === 'warning'
                        ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                        : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                    }`}
                  >
                    {item.status === 'passed' ? (
                      <><Check className="w-3 h-3 mr-1.5" />Passed</>
                    ) : item.status === 'warning' ? (
                      <><AlertTriangle className="w-3 h-3 mr-1.5" />Needs Attention</>
                    ) : (
                      <><X className="w-3 h-3 mr-1.5" />Failed</>
                    )}
                  </span>
                </div>

                {/* View Full Size (hover) */}
                {item.status === 'passed' && (
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <button className="text-xs text-white/80 hover:text-white flex items-center gap-2">
                      <ZoomIn className="w-4 h-4" />
                      View Full Size
                    </button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 border-t border-gray-200 dark:border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-white/80 truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-white/40">
                    {item.resolution}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-1/3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-white/40 mb-2">
              <span>Step 5 of 6</span>
              <span>83% Completed</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 dark:bg-indigo-500 w-[83%] rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm font-medium inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {!canContinue && (
              <button
                onClick={handleFixLater}
                className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Fix Later
              </button>
            )}
            <button
              onClick={onContinue}
              disabled={!canContinue || isSaving}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                canContinue
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-300 dark:bg-white/10 text-gray-500 dark:text-white/40 cursor-not-allowed'
              }`}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Sidebar - with independent scrolling */}
      <aside className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0a0a0a] lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Requirements Checklist */}
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-3">
              Media Requirements
            </h3>
            <ul className="space-y-2.5">
              {requirements.map((req) => (
                <li key={req.id} className="flex items-center gap-2.5 text-sm">
                  {req.status === 'passed' ? (
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : req.status === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className={req.status === 'passed' ? 'text-gray-700 dark:text-white/80' : 'text-gray-500 dark:text-white/50'}>
                    {req.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleAutoFixAll}
                disabled={isAutoFixing || allPassed}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Wand2 className="w-4 h-4 text-purple-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Auto-Enhance</div>
                    <div className="text-xs text-gray-500 dark:text-white/40">Fix lighting & color</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Crop className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Smart Crop</div>
                    <div className="text-xs text-gray-500 dark:text-white/40">Center products</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Batch Upload</div>
                    <div className="text-xs text-gray-500 dark:text-white/40">Replace multiple</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p className="text-xs text-gray-700 dark:text-white/70 leading-relaxed">
                <span className="font-semibold text-gray-900 dark:text-white">Pro Tip:</span>{' '}
                High-quality images increase conversion by up to 40%.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StoreMediaReviewStep;

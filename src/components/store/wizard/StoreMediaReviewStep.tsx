import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  X,
  Wand2,
  Crop,
  Upload,
  ZoomIn,
  Lightbulb,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import type { StoreWizardData, MediaItem } from '@/types/storeWizard';

interface StoreMediaReviewStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

// Mock media items for demo
const MOCK_MEDIA: MediaItem[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800',
    name: 'Main Product Shot',
    resolution: '2400 x 3200px',
    status: 'passed',
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1529139574466-a302d2d3f524?w=600',
    name: 'Detail Shot',
    resolution: '600 x 800px',
    status: 'failed',
    issues: [{ type: 'resolution', message: 'Image is 600x800px. Minimum required is 1200x1200px.' }],
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
    name: 'Lifestyle Shot',
    resolution: '1600 x 1200px',
    status: 'warning',
    issues: [{ type: 'composition', message: 'Product occupies less than 60% of the frame.' }],
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800',
    name: 'Model Shot',
    resolution: '2000 x 2000px',
    status: 'passed',
  },
];

// Requirements checklist
const REQUIREMENTS = [
  { id: 'resolution', label: 'Min 1200x1200px resolution', status: 'passed' as const },
  { id: 'angles', label: 'At least 3 product angles', status: 'passed' as const },
  { id: 'model', label: 'On-model shot included', status: 'failed' as const },
  { id: 'quality', label: 'Clear, professional quality', status: 'warning' as const },
  { id: 'watermark', label: 'No watermarks or overlays', status: 'passed' as const },
];

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
  // Use mock data if no media items
  const mediaItems = data.mediaItems.length > 0 ? data.mediaItems : MOCK_MEDIA;

  // Count issues
  const failedCount = mediaItems.filter((m) => m.status === 'failed').length;
  const warningCount = mediaItems.filter((m) => m.status === 'warning').length;
  const issueCount = failedCount + warningCount;
  const allPassed = issueCount === 0;

  // Can continue if no failed items (warnings are allowed)
  const canContinue = failedCount === 0;

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-8 overflow-y-auto">
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
          className={`bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            allPassed
              ? 'border-green-500/30 border-l-4 border-l-green-500'
              : 'border-orange-500/30 border-l-4 border-l-orange-500'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                allPassed
                  ? 'bg-green-500/20'
                  : 'bg-orange-500/20'
              }`}
            >
              {allPassed ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              )}
            </div>
            <div>
              <h3
                className={`font-semibold text-lg ${
                  allPassed
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}
              >
                {allPassed
                  ? 'All media passed quality checks'
                  : `${issueCount} item${issueCount > 1 ? 's' : ''} need attention`}
              </h3>
              <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
                {allPassed
                  ? 'Your media meets all marketplace standards.'
                  : "Some images don't meet the minimum resolution or composition requirements."}
              </p>
            </div>
          </div>
          {!allPassed && (
            <button className="px-4 py-2 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap border border-gray-200 dark:border-white/10 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-600 dark:text-indigo-400" />
              Auto-fix All
            </button>
          )}
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="relative h-64 w-full bg-gray-100 dark:bg-gray-900">
                <img
                  src={item.url}
                  alt={item.name}
                  className={`w-full h-full object-cover transition-opacity ${
                    item.status === 'failed' ? 'opacity-80' : 'opacity-90 group-hover:opacity-100'
                  }`}
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

                {/* Overlay for failed */}
                {item.status === 'failed' && (
                  <>
                    <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[1px]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2">
                        <RotateCw className="w-4 h-4" />
                        Replace Image
                      </button>
                    </div>
                  </>
                )}

                {/* View Full Size (hover) */}
                {item.status === 'passed' && (
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <button className="text-xs text-white/80 hover:text-white flex items-center gap-2">
                      <ZoomIn className="w-4 h-4" />
                      View Full Size
                    </button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div
                className={`p-4 border-t ${
                  item.status === 'failed'
                    ? 'bg-red-500/5 border-gray-200 dark:border-white/5'
                    : item.status === 'warning'
                    ? 'bg-orange-500/5 border-gray-200 dark:border-white/5'
                    : 'border-gray-200 dark:border-white/5'
                }`}
              >
                {item.issues && item.issues.length > 0 ? (
                  <>
                    <div className="flex items-start gap-3 mb-3">
                      <AlertTriangle
                        className={`w-4 h-4 mt-0.5 ${
                          item.status === 'failed' ? 'text-red-500' : 'text-orange-500'
                        }`}
                      />
                      <div>
                        <h4
                          className={`text-sm font-medium ${
                            item.status === 'failed'
                              ? 'text-red-700 dark:text-red-200'
                              : 'text-orange-700 dark:text-orange-200'
                          }`}
                        >
                          {item.issues[0].type === 'resolution'
                            ? 'Resolution too low'
                            : 'Subject not centered'}
                        </h4>
                        <p
                          className={`text-xs mt-0.5 ${
                            item.status === 'failed'
                              ? 'text-red-600/60 dark:text-red-200/60'
                              : 'text-orange-600/60 dark:text-orange-200/60'
                          }`}
                        >
                          {item.issues[0].message}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {item.status === 'failed' ? (
                        <button className="text-xs bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded text-gray-700 dark:text-white/80 transition-colors">
                          Upscale (AI)
                        </button>
                      ) : (
                        <button className="text-xs bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 px-3 py-1.5 rounded text-orange-700 dark:text-orange-200 transition-colors flex items-center gap-1">
                          <Crop className="w-3 h-3" />
                          Auto-Crop
                        </button>
                      )}
                      <button className="text-xs bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded text-gray-700 dark:text-white/80 transition-colors">
                        Details
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-white/80">
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-white/40">
                      {item.resolution}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
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
              className="px-6 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Back
            </button>
            {!canContinue && (
              <button className="px-6 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm font-medium">
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

      {/* Sidebar */}
      <aside className="w-full lg:w-80 p-4 sm:p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0f0f0f]/50">
        <div className="lg:sticky lg:top-24 space-y-6">
          {/* Requirements Checklist */}
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-white uppercase tracking-wider opacity-70 mb-4">
              Media Requirements
            </h3>
            <ul className="space-y-3">
              {REQUIREMENTS.map((req) => (
                <li key={req.id} className="flex items-start gap-3 text-sm">
                  {req.status === 'passed' ? (
                    <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  ) : req.status === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-red-500 mt-0.5" />
                  )}
                  <span
                    className={
                      req.status === 'passed'
                        ? 'text-gray-700 dark:text-white/80'
                        : 'text-gray-500 dark:text-white/60'
                    }
                  >
                    {req.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-white uppercase tracking-wider opacity-70 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-indigo-400">
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-indigo-300 transition-colors">
                      Auto-Enhance
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/40">
                      Fix lighting & color
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-white/20" />
              </button>

              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Crop className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                      Smart Crop
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/40">
                      Center products
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-white/20" />
              </button>

              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                      Batch Upload
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/40">
                      Replace multiple
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-white/20" />
              </button>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/10 dark:border-white/5">
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 dark:text-white/70 leading-relaxed">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Pro Tip:
                </span>{' '}
                High-quality images increase conversion by up to 40%. It's worth
                getting this right!
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StoreMediaReviewStep;

import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Send,
  Save,
  Link,
  Instagram,
  Globe,
  ExternalLink,
} from 'lucide-react';
import type { StoreWizardData } from '@/pages/store/StoreCreationWizard';

interface StoreReviewStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isSaving?: boolean;
}

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  streetwear: 'Streetwear',
  casual: 'Casual Wear',
  formal: 'Formal',
  athletic: 'Athletic',
  vintage: 'Vintage',
  luxury: 'Luxury',
  sustainable: 'Sustainable',
  accessories: 'Accessories',
};

/**
 * Store Review Step (Screen 1.10)
 * Step 6 of 6: Final review before publishing
 */
const StoreReviewStep: React.FC<StoreReviewStepProps> = ({
  data,
  onChange,
  onBack,
  onSubmit,
  onSaveDraft,
  isSaving = false,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Check if all requirements are met
  const basicComplete = Boolean(data.name && data.slug && data.categories.length > 0);
  const socialComplete = Boolean(data.instagram || data.tiktok || data.twitter || data.website);
  const policiesComplete = Boolean(data.shippingRegions.length > 0 && data.processingTime);
  const catalogComplete = data.products.length >= 3 && (data.collections.length >= 1 || data.looks.length >= 1);
  const mediaComplete = true; // Mock for now
  const allRequirementsMet = basicComplete && policiesComplete && catalogComplete && mediaComplete;

  const toggleSection = useCallback((section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);

  const handleTermsChange = useCallback(
    (checked: boolean) => {
      onChange({ termsAccepted: checked });
    },
    [onChange]
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#1a1a1a]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Review & Publish
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Step 6 of 6 - Final review before going live
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  allRequirementsMet
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-orange-500/10 border-orange-500/20'
                }`}
              >
                <Check
                  className={
                    allRequirementsMet
                      ? 'w-4 h-4 text-green-500'
                      : 'w-4 h-4 text-orange-500'
                  }
                />
                <span
                  className={`text-sm font-medium ${
                    allRequirementsMet
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {allRequirementsMet
                    ? 'All Requirements Met'
                    : 'Some Requirements Missing'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Store Preview & Sections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Store Preview Card */}
            <div className="bg-white dark:bg-[#1e1e1e]/50 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              {/* Banner */}
              <div className="h-48 bg-gradient-to-br from-purple-600/20 via-pink-500/20 to-orange-500/20 relative">
                {data.bannerPreview && (
                  <img
                    src={data.bannerPreview}
                    alt="Banner"
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                )}
              </div>

              {/* Store Header */}
              <div className="p-6 -mt-16 relative">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 bg-white dark:bg-[#1e1e1e] border-4 border-white dark:border-[#0f0f0f] rounded-2xl overflow-hidden flex-shrink-0">
                    {data.logoPreview ? (
                      <img
                        src={data.logoPreview}
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                        Logo
                      </div>
                    )}
                  </div>
                  <div className="flex-1 mt-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {data.name || 'Your Store Name'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {data.tagline || 'Your store tagline will appear here'}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      {data.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-600 dark:text-purple-300"
                        >
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                      ))}
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span>0 Followers</span>
                        <span>•</span>
                        <span>0 Reviews</span>
                        <span>•</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {data.products.length} Products
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      {data.instagram && (
                        <span className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer">
                          <Instagram className="w-5 h-5" />
                        </span>
                      )}
                      {data.twitter && (
                        <span className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </span>
                      )}
                      {data.tiktok && (
                        <span className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                          </svg>
                        </span>
                      )}
                      {data.website && (
                        <span className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer">
                          <Globe className="w-5 h-5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Reviews */}
            <div className="space-y-4">
              {/* Basic Info */}
              <SectionCard
                title="Basic Information"
                subtitle="Store name, slug, category & description"
                isComplete={basicComplete}
                isExpanded={expandedSection === 'basic'}
                onToggle={() => toggleSection('basic')}
              >
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <InfoItem label="Store Name" value={data.name || '-'} />
                  <InfoItem label="Store Slug" value={data.slug || '-'} />
                  <InfoItem
                    label="Category"
                    value={
                      data.categories
                        .map((c) => CATEGORY_LABELS[c] || c)
                        .join(', ') || '-'
                    }
                  />
                  <InfoItem label="Location" value="Lagos, Nigeria" />
                  <div className="col-span-2">
                    <InfoItem label="Description" value={data.description || '-'} />
                  </div>
                </div>
              </SectionCard>

              {/* Social & Verification */}
              <SectionCard
                title="Social & Verification"
                subtitle="Connected accounts & verification status"
                isComplete={socialComplete}
                isExpanded={expandedSection === 'social'}
                onToggle={() => toggleSection('social')}
              >
                <div className="space-y-3 mt-4">
                  {data.instagram && (
                    <SocialItem platform="Instagram" username={data.instagram} />
                  )}
                  {data.twitter && (
                    <SocialItem platform="Twitter" username={data.twitter} />
                  )}
                  {data.tiktok && (
                    <SocialItem platform="TikTok" username={data.tiktok} />
                  )}
                  {!data.instagram && !data.twitter && !data.tiktok && (
                    <p className="text-sm text-gray-500">No social accounts connected</p>
                  )}
                  {data.domainVerificationStatus === 'verified' && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Identity Verified
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Store Policies */}
              <SectionCard
                title="Store Policies"
                subtitle="Shipping, returns, size guide & response time"
                isComplete={policiesComplete}
                isExpanded={expandedSection === 'policies'}
                onToggle={() => toggleSection('policies')}
              >
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <InfoItem
                    label="Processing Time"
                    value={data.processingTime || '-'}
                  />
                  <InfoItem
                    label="Return Window"
                    value={data.returnWindow ? `${data.returnWindow} days` : '-'}
                  />
                  <InfoItem
                    label="Response Time SLA"
                    value={data.responseTimeSla || '-'}
                  />
                  <InfoItem
                    label="Size Guide"
                    value={data.sizeChartUrl ? 'Available' : 'Not uploaded'}
                  />
                </div>
              </SectionCard>

              {/* Product Catalog */}
              <SectionCard
                title="Product Catalog"
                subtitle={`${data.products.length} products • ${data.collections.length} collections`}
                isComplete={catalogComplete}
                isExpanded={expandedSection === 'catalog'}
                onToggle={() => toggleSection('catalog')}
                editLabel="Edit Catalog"
              >
                <div className="grid grid-cols-4 gap-3 mt-4">
                  {data.products.slice(0, 4).map((product) => (
                    <div
                      key={product.id}
                      className="aspect-square bg-gray-100 dark:bg-[#1a1a1a] rounded-lg overflow-hidden"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  {data.products.length === 0 &&
                    [1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="aspect-square bg-gray-100 dark:bg-[#1a1a1a] rounded-lg flex items-center justify-center text-gray-400 text-xs"
                      >
                        No product
                      </div>
                    ))}
                </div>
                {data.collections.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Collections:{' '}
                      <span className="text-gray-900 dark:text-white">
                        {data.collections.map((c) => c.name).join(', ')}
                      </span>
                    </p>
                  </div>
                )}
              </SectionCard>

              {/* Media Standards */}
              <SectionCard
                title="Media Standards"
                subtitle="All quality checks passed"
                isComplete={mediaComplete}
                isExpanded={expandedSection === 'media'}
                onToggle={() => toggleSection('media')}
                editLabel="Review Media"
              >
                <div className="space-y-3 mt-4">
                  <StatusItem label="Image Quality" passed />
                  <StatusItem label="Resolution Standards" passed />
                  <StatusItem label="Background Requirements" passed />
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Right Column - Readiness Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-white/80 dark:from-[#1e1e1e]/80 to-gray-50 dark:to-[#1e1e1e]/40 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-2xl p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCheck className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white font-bold">
                    Ready to Publish
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    All requirements met
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <ReadinessItem label="Basic info complete" checked={basicComplete} />
                <ReadinessItem label="Policies set" checked={policiesComplete} />
                <ReadinessItem label="3+ products added" checked={data.products.length >= 3} />
                <ReadinessItem label="1+ collection/look" checked={catalogComplete} />
                <ReadinessItem label="Media standards met" checked={mediaComplete} />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-3">
                <button
                  onClick={onSubmit}
                  disabled={!allRequirementsMet || !data.termsAccepted || isSaving}
                  className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    allRequirementsMet && data.termsAccepted
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:shadow-lg hover:shadow-purple-500/20 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Submit for Review
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                  Your store will go live after moderation review (usually within
                  24 hours)
                </p>

                <button
                  onClick={onSaveDraft}
                  className="w-full py-3 bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e1e1e] transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save & Continue Later
                </button>

                <button className="w-full py-3 bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e1e1e] transition-colors flex items-center justify-center gap-2">
                  <Link className="w-4 h-4" />
                  Get Preview Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e1e1e] transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.termsAccepted}
                onChange={(e) => handleTermsChange(e.target.checked)}
                className="w-5 h-5 bg-gray-100 dark:bg-[#1a1a1a] border-gray-300 dark:border-gray-700 rounded text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                I agree to Threadly's{' '}
                <a
                  href="#"
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="#"
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  Store Guidelines
                </a>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components

interface SectionCardProps {
  title: string;
  subtitle: string;
  isComplete: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  editLabel?: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  isComplete,
  isExpanded,
  onToggle,
  editLabel = 'Edit',
  children,
}) => (
  <div className="bg-white dark:bg-[#1e1e1e]/50 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isComplete
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-orange-500/10 border border-orange-500/20'
          }`}
        >
          <Check
            className={isComplete ? 'w-5 h-5 text-green-500' : 'w-5 h-5 text-orange-500'}
          />
        </div>
        <div className="text-left">
          <h3 className="text-gray-900 dark:text-white font-semibold">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium">
          {editLabel}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </div>
    </button>
    {isExpanded && (
      <div className="px-5 pb-5 border-t border-gray-200 dark:border-gray-800">
        {children}
      </div>
    )}
  </div>
);

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{label}</p>
    <p className="text-gray-900 dark:text-white">{value}</p>
  </div>
);

const SocialItem: React.FC<{ platform: string; username: string }> = ({
  platform,
  username,
}) => (
  <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg">
    <div className="flex items-center gap-3">
      {platform === 'Instagram' && <Instagram className="w-4 h-4 text-pink-500" />}
      {platform === 'Twitter' && (
        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )}
      {platform === 'TikTok' && (
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      )}
      <span className="text-gray-900 dark:text-white">@{username}</span>
    </div>
    <span className="text-xs text-green-500">Connected</span>
  </div>
);

const StatusItem: React.FC<{ label: string; passed: boolean }> = ({ label, passed }) => (
  <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg">
    <span className="text-gray-700 dark:text-white text-sm">{label}</span>
    <span className={`text-xs ${passed ? 'text-green-500' : 'text-red-500'}`}>
      {passed ? '✓ Passed' : '✗ Failed'}
    </span>
  </div>
);

const ReadinessItem: React.FC<{ label: string; checked: boolean }> = ({
  label,
  checked,
}) => (
  <div className="flex items-center gap-3">
    <Check
      className={checked ? 'w-4 h-4 text-green-500' : 'w-4 h-4 text-gray-400'}
    />
    <span
      className={checked ? 'text-sm text-gray-700 dark:text-gray-300' : 'text-sm text-gray-500'}
    >
      {label}
    </span>
  </div>
);

export default StoreReviewStep;

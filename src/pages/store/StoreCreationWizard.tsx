import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { showNotice } from '@/components/ui/NoticeModal';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

// Step Components
import StoreSocialStep from '@/components/store/wizard/StoreSocialStep';
import StorePoliciesStep from '@/components/store/wizard/StorePoliciesStep';
import StoreHoursStep from '@/components/store/wizard/StoreHoursStep';
import StoreReviewStep from '@/components/store/wizard/StoreReviewStep';

// API
import {
  getStoreStatus,
  updateStoreProfile,
  getStoreWizardPrefill,
  getStorePolicies,
  openStore,
  updateStorePolicies,
  type StoreProfileUpdateData,
  type StorePoliciesUpdateData,
} from '@/api/StoreApi';
import {
  getRequiredLegalAcceptances,
  LEGAL_STORE_PUBLISH_DOCUMENT_KEYS,
} from '@/api/LegalApi';

import type { StoreWizardData } from '@/types/storeWizard';
import {
  clearStoreProgressLocally,
  markStoreOpenPending,
  readStoreProgressLocally,
  sanitizeSingleSocialLink,
  saveStoreProgressLocally,
} from '@/utils/storeSetup';
import { primeStoreSetupStatusCache } from '@/hooks/useStoreSetupStatus';
import StoreSetupProgress from '@/components/store/StoreSetupProgress';
import { invalidateRequireStoreSetupCache } from '@/components/store/RequireStoreSetup';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/query/queryKeys';
import type { StoreStatusResponse } from '@/api/StoreApi';
import {
  sanitizeCustomOrderLeadTime,
  sanitizeResponseTimeSla,
  sanitizeReturnWindow,
  sanitizeShippingRegions,
} from '@/utils/storePolicyConstraints';

// Initial empty state for the wizard
const initialData: StoreWizardData = {
  // Step 1: Basic Info
  name: '',
  slug: '',
  categories: [],
  tagline: '',
  description: '',
  logoPreview: null,
  bannerPreview: null,
  
  // Step 2: Social & Verification
  instagram: '',
  tiktok: '',
  twitter: '',
  website: '',
  tags: [],
  domainVerificationStatus: 'optional',
  
  // Step 3: Policies
  shippingRegions: [],
  processingTime: '',
  shippingMethods: [],
  freeShippingThreshold: null,
  shippingMethod: 'standard',
  shippingRates: [],
  orderProcessingMode: 'auto-confirm',
  orderCancellationWindow: '24h',
  allowOrderNotes: true,
  returnsAccepted: true,
  returnWindow: '14',
  returnConditions: [],
  refundMethod: 'original',
  sizeChartFile: null,
  sizeChartUrl: null,
  sizeChartPresetKey: null,
  sizeChartSystem: null,
  responseTimeSla: '24h',
  contactEmail: '',
  customOrdersEnabled: false,
  customOrderLeadTime: '2-4',
  customOrderRushSupported: false,

  // Step 4: Catalog
  products: [],
  collections: [],
  looks: [],
  catalogActiveTab: 'collections',

  // Step 5: Media Review
  mediaItems: [],
  
  // Step 6: Final Review
  termsAccepted: false,
};

// Essentials is now collected before this wizard. These are the remaining setup steps.
// `hours` is REQUIRED — the server counts business hours in store completeness,
// so publishing fails without it. It sits before `review` so the brand cannot
// reach the Publish button with hours outstanding.
type WizardStep =
  | 'social'
  | 'policies'
  | 'hours'
  | 'review';

const STEP_ORDER: WizardStep[] = [
  'social',
  'policies',
  'hours',
  'review',
];

type WizardSaveState = 'idle' | 'saving' | 'saved' | 'error';

const MAX_STORE_DESCRIPTION_LEN = 500;
const MAX_STORE_TAGLINE_LEN = 100;
const MAX_STORE_CONTACT_EMAIL_LEN = 254;
const MAX_STORE_SOCIAL_HANDLE_LEN = 60;
const MAX_STORE_WEBSITE_LEN = 200;
const MAX_STORE_CATEGORIES = 4;
// Stays 2 even though `hours` was inserted before `review`. This number is a
// contract shared with `StoreEssentials` (which writes it) and
// `resolveStoreSetupDestination` (which requires === 2 to route into this
// wizard) — bumping it here alone would send finished-essentials brands back to
// the essentials page. No bump is needed anyway: the old step numbers now
// resolve to 1→social, 2→policies, 3→hours, so a draft saved at the old
// "review" resumes on the new required step instead of skipping past it.
const STORE_SETUP_WIZARD_VERSION = 2;

const sanitizeWizardData = (data: StoreWizardData): StoreWizardData => {
  const safeString = (value: unknown, maxLen: number): string => {
    if (typeof value !== 'string') return '';
    return value.slice(0, maxLen);
  };

  const safeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  };

  const safeCategories = safeStringArray(data.categories).slice(0, MAX_STORE_CATEGORIES);
  const safeTags = safeStringArray(data.tags);

  return {
    ...data,
    description: safeString(data.description, MAX_STORE_DESCRIPTION_LEN),
    tagline: safeString(data.tagline, MAX_STORE_TAGLINE_LEN),
    contactEmail: safeString(data.contactEmail, MAX_STORE_CONTACT_EMAIL_LEN),
    instagram: safeString(data.instagram, MAX_STORE_SOCIAL_HANDLE_LEN),
    twitter: safeString(data.twitter, MAX_STORE_SOCIAL_HANDLE_LEN),
    tiktok: safeString(data.tiktok, MAX_STORE_SOCIAL_HANDLE_LEN),
    website: safeString(data.website, MAX_STORE_WEBSITE_LEN),
    categories: safeCategories,
    tags: safeTags.length ? safeTags : safeCategories,
  };
};

const stepToNumber = (step: WizardStep): number => {
  return STEP_ORDER.indexOf(step) + 1;
};

const restoreWizardStep = (localDraft: Record<string, unknown> | null): WizardStep => {
  if (!localDraft) return 'social';

  const rawStep = Number(localDraft.step);
  const hasNumericStep = Number.isFinite(rawStep);
  if (!hasNumericStep) {
    return 'social';
  }

  if (localDraft.setupWizardVersion !== STORE_SETUP_WIZARD_VERSION) {
    return 'social';
  }

  const stepIndex = Math.min(Math.max(rawStep - 1, 0), STEP_ORDER.length - 1);
  return STEP_ORDER[stepIndex] ?? 'social';
};

/**
 * Store Creation Wizard
 * Store onboarding flow for brands after Store Essentials is complete.
 */
const StoreCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);
  
  // Current step state
  const [currentStep, setCurrentStep] = useState<WizardStep>('social');
  const [wizardData, setWizardData] = useState<StoreWizardData>(initialData);
  const [hasLiveStore, setHasLiveStore] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<WizardSaveState>('idle');
  const queryClient = useQueryClient();
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  
  // Refs for autosave
  const lastSavedPayloadRef = useRef<string>('');
  const lastSavedPolicyRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // --- SAVE TO LOCAL STORAGE (Immediate, on every change) ---
  const saveToLocalStorage = useCallback(() => {
    try {
      const localData = {
        ...wizardData,
        step: stepToNumber(currentStep),
        setupWizardVersion: STORE_SETUP_WIZARD_VERSION,
        savedAt: Date.now(),
        ownerUserId: user?.id ?? null,
      };
      saveStoreProgressLocally(localData, user?.id);
    } catch (error) {
      console.error('Failed to save to localStorage', error);
    }
  }, [wizardData, currentStep, user?.id]);

  // Save to localStorage immediately when data or step changes
  useEffect(() => {
    if (!isLoadingDraft) {
      saveToLocalStorage();
    }
  }, [wizardData, currentStep, isLoadingDraft, saveToLocalStorage]);

  // --- API SAVE LOGIC (Debounced, for server sync) ---
  const buildSavePayload = useCallback(() => {
    const resolvedTags = wizardData.categories?.length ? wizardData.categories : wizardData.tags;
    const payload: StoreProfileUpdateData = {
      tagline: wizardData.tagline,
      description: wizardData.description,
      socialInstagram: wizardData.instagram,
      socialTiktok: wizardData.tiktok,
      socialTwitter: wizardData.twitter,
      socialWebsite: wizardData.website,
      contactEmail: wizardData.contactEmail,
      tags: resolvedTags,
    };
    return payload;
  }, [wizardData]);

  const buildPolicyPayload = useCallback(() => {
    const hasSizeChart = Boolean(wizardData.sizeChartUrl || wizardData.sizeChartPresetKey);
    const sizeChart = hasSizeChart
      ? {
          url: wizardData.sizeChartUrl,
          presetKey: wizardData.sizeChartPresetKey,
          system: wizardData.sizeChartSystem,
        }
      : null;

    const hasShippingRules = Boolean(
      (wizardData.shippingRates && wizardData.shippingRates.length > 0) ||
        wizardData.shippingMethod
    );
    const shippingRules = hasShippingRules
      ? {
          shippingRates: wizardData.shippingRates,
          shippingMethod: wizardData.shippingMethod,
          orderSettings: {
            orderProcessingMode: wizardData.orderProcessingMode,
            orderCancellationWindow: wizardData.orderCancellationWindow,
            allowOrderNotes: wizardData.allowOrderNotes,
          },
          customOrderSettings: {
            customOrdersEnabled: wizardData.customOrdersEnabled,
            leadTime: wizardData.customOrderLeadTime,
            rushSupported: wizardData.customOrderRushSupported,
          },
        }
      : null;

    const payload: StorePoliciesUpdateData = {
      shippingRegions: wizardData.shippingRegions,
      processingTime: wizardData.processingTime,
      shippingMethods: wizardData.shippingMethods,
      freeShippingThreshold: wizardData.freeShippingThreshold,
      returnsAccepted: wizardData.returnsAccepted,
      returnWindow: wizardData.returnWindow,
      returnConditions: wizardData.returnConditions,
      refundMethod: wizardData.refundMethod,
      responseTimeSla: wizardData.responseTimeSla,
      sizeChart,
      shippingRules,
    };

    return payload;
  }, [wizardData]);

  const persistProgress = useCallback(
    async (reason?: string) => {
      const payload = buildSavePayload();
      const policyPayload = buildPolicyPayload();
      const serialized = JSON.stringify(payload);
      const policySerialized = JSON.stringify(policyPayload);

      const profileDirty = serialized !== lastSavedPayloadRef.current;
      const policyDirty = policySerialized !== lastSavedPolicyRef.current;
      if (!profileDirty && !policyDirty) return;

      setSaveState('saving');
      try {
        const ops: Promise<unknown>[] = [];
        if (profileDirty) ops.push(updateStoreProfile(payload));
        if (policyDirty) ops.push(updateStorePolicies(policyPayload));
        await Promise.all(ops);
        if (profileDirty) lastSavedPayloadRef.current = serialized;
        if (policyDirty) lastSavedPolicyRef.current = policySerialized;
        setSaveState('saved');
      } catch (error) {
        console.error('Failed to save store progress', { reason, error });
        setSaveState('error');
      }
    },
    [buildSavePayload, buildPolicyPayload]
  );

  // --- HYDRATION ---
  useEffect(() => {
    let isCancelled = false;
    const hydrateDraft = async () => {
      setIsLoadingDraft(true);
      
      // Load local draft first
      const localDraft = readStoreProgressLocally<Record<string, unknown>>(
        user?.id,
      );
      const localDraftForMerge = localDraft ? { ...localDraft } : null;
      if (
        localDraftForMerge &&
        localDraftForMerge.setupWizardVersion !== STORE_SETUP_WIZARD_VERSION
      ) {
        delete localDraftForMerge.categories;
        delete localDraftForMerge.tags;
      }

      // Start with initial data, then layer local draft on top
      let nextData: StoreWizardData = localDraftForMerge
        ? { ...initialData, ...(localDraftForMerge as Partial<StoreWizardData>) }
        : initialData;

      // 1) Server store status - only override server-synced fields
      try {
        const response = await getStoreStatus();
        if (!isCancelled) {
          // Redirect away once the setup FLOW is complete — independent of whether
          // the store is currently open or paused. Completed brands never re-enter setup.
          setHasLiveStore(Boolean(response?.isSetupComplete));
        }

        // Server data only overrides specific fields (not policies, products, etc.)
        if (response?.profile) {
          nextData = {
            ...nextData, // Keep local draft data for policies, products, collections
            // Override only server-synced fields
            name: response.profile.name || nextData.name,
            description: response.profile.description || nextData.description,
            tagline: response.profile.tagline || nextData.tagline,
            tags: response.profile.tags?.length ? response.profile.tags : nextData.tags,
            contactEmail: response.profile.contactEmail || nextData.contactEmail,
            instagram: response.profile.socialInstagram || nextData.instagram,
            twitter: response.profile.socialTwitter || nextData.twitter,
            tiktok: response.profile.socialTiktok || nextData.tiktok,
            website: response.profile.socialWebsite || nextData.website,
            responseTimeSla: response.profile.responseTimeSla || nextData.responseTimeSla,
          };
        }
      } catch (error) {
        console.error('Failed to load store status from server', error);
        // Local draft is already applied above
      }

      // 2) Prefill from brand data - only for empty fields
      try {
        const prefill = await getStoreWizardPrefill();
        if (!isCancelled && prefill) {
          nextData = {
            ...nextData,
            // Canonical identity fields (always from prefill)
            name: prefill.brand.storeName || nextData.name,
            slug: prefill.brand.slug || nextData.slug,
            // Only fill empty fields
            contactEmail: nextData.contactEmail || prefill.brand.contactEmail || '',
            description: nextData.description || prefill.brand.description || '',
            instagram: nextData.instagram || prefill.brand.instagram || '',
            twitter: nextData.twitter || prefill.brand.twitter || '',
            website: nextData.website || prefill.brand.website || '',
            tagline: nextData.tagline || prefill.brand.tagline || '',
            tags: nextData.tags?.length ? nextData.tags : [],
            responseTimeSla: nextData.responseTimeSla || prefill.brand.responseTimeSla || '24h',
          };
        }
      } catch (error) {
        console.error('Failed to prefill wizard data', error);
      }

      // 2.5) Policy prefill
      try {
        const policy = await getStorePolicies();
        if (!isCancelled && policy) {
          nextData = {
            ...nextData,
            shippingRegions: policy.shippingRegions?.length
              ? sanitizeShippingRegions(policy.shippingRegions)
              : nextData.shippingRegions,
            processingTime: policy.processingTime || nextData.processingTime,
            shippingMethods: policy.shippingMethods?.length ? policy.shippingMethods : nextData.shippingMethods,
            freeShippingThreshold:
              policy.freeShippingThreshold !== null && policy.freeShippingThreshold !== undefined
                ? policy.freeShippingThreshold
                : nextData.freeShippingThreshold,
            returnsAccepted:
              typeof policy.returnsAccepted === 'boolean'
                ? policy.returnsAccepted
                : nextData.returnsAccepted,
            returnWindow: sanitizeReturnWindow(policy.returnWindow || nextData.returnWindow),
            returnConditions: policy.returnConditions?.length ? policy.returnConditions : nextData.returnConditions,
            refundMethod: policy.refundMethod || nextData.refundMethod,
            responseTimeSla: sanitizeResponseTimeSla(policy.responseTimeSla || nextData.responseTimeSla),
            sizeChartUrl: policy.sizeChart?.url ?? nextData.sizeChartUrl,
            sizeChartPresetKey: policy.sizeChart?.presetKey ?? nextData.sizeChartPresetKey,
            sizeChartSystem: policy.sizeChart?.system ?? nextData.sizeChartSystem,
            shippingRates: Array.isArray(policy.shippingRules?.shippingRates)
              ? policy.shippingRules?.shippingRates
              : nextData.shippingRates,
            shippingMethod: policy.shippingRules?.shippingMethod || nextData.shippingMethod,
            orderProcessingMode:
              policy.shippingRules?.orderSettings?.orderProcessingMode || nextData.orderProcessingMode,
            orderCancellationWindow:
              policy.shippingRules?.orderSettings?.orderCancellationWindow || nextData.orderCancellationWindow,
            allowOrderNotes:
              typeof policy.shippingRules?.orderSettings?.allowOrderNotes === 'boolean'
                ? policy.shippingRules.orderSettings.allowOrderNotes
                : nextData.allowOrderNotes,
            customOrdersEnabled:
              typeof policy.shippingRules?.customOrderSettings?.customOrdersEnabled === 'boolean'
                ? policy.shippingRules.customOrderSettings.customOrdersEnabled
                : nextData.customOrdersEnabled,
            customOrderLeadTime: sanitizeCustomOrderLeadTime(
              policy.shippingRules?.customOrderSettings?.leadTime || nextData.customOrderLeadTime,
            ),
            customOrderRushSupported:
              typeof policy.shippingRules?.customOrderSettings?.rushSupported === 'boolean'
                ? policy.shippingRules.customOrderSettings.rushSupported
                : nextData.customOrderRushSupported,
          };
        }
      } catch (error) {
        console.error('Failed to load store policies', error);
      }

      // 3) Local fallback from authenticated profile (if API calls failed)
      if (user) {
        const fallbackName =
          (user.brandFullName ?? '').trim() ||
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
          user.username ||
          '';
        const fallbackSlug = user.username || '';
        nextData = {
          ...nextData,
          name: nextData.name || fallbackName,
          slug: nextData.slug || fallbackSlug,
          contactEmail: nextData.contactEmail || user.email || '',
        };
      }

      if (!isCancelled) {
        const sanitized = sanitizeWizardData({
          ...nextData,
          ...sanitizeSingleSocialLink(nextData),
          shippingRegions: sanitizeShippingRegions(nextData.shippingRegions),
          returnWindow: sanitizeReturnWindow(nextData.returnWindow),
          responseTimeSla: sanitizeResponseTimeSla(nextData.responseTimeSla),
          customOrderLeadTime: sanitizeCustomOrderLeadTime(nextData.customOrderLeadTime),
        });
        setWizardData(sanitized);
        setCurrentStep(restoreWizardStep(localDraft));
        setIsLoadingDraft(false);
      }
    };

    hydrateDraft();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  // Redirect if the brand has already completed store setup — they must never be
  // shown / routed back into the setup wizard.
  useEffect(() => {
    if (hasLiveStore) {
      navigate('/studio/store', { replace: true });
    }
  }, [hasLiveStore, navigate]);

  // Auto-save: debounce on changes
  useEffect(() => {
    if (isLoadingDraft) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistProgress('debounced');
    }, 900);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [wizardData, currentStep, isLoadingDraft, persistProgress]);

  // Periodic auto-save
  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      void persistProgress('interval');
    }, 30_000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [persistProgress]);

  // Save on visibility change
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void persistProgress('visibility-hidden');
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [persistProgress]);

  // --- NAVIGATION ---
  const handleDataChange = useCallback((updates: Partial<StoreWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const goToPrevStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/studio/store/essentials');
    }
  }, [currentStep, navigate]);

  // Go to specific step (for edit navigation from review page)
  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Final publish handler - publishes store immediately
  const handlePublishStore = useCallback(async () => {
    setSaveState('saving');
    try {
      // Save any final data
      await persistProgress('publish');
      
      const legalAcceptances = await getRequiredLegalAcceptances(
        LEGAL_STORE_PUBLISH_DOCUMENT_KEYS,
      );
      await openStore({ legalAcceptances });

      // Publishing changes the answer to "is this store set up?", and TWO
      // separate caches hold that answer. Priming only the module cache was not
      // enough: `useStoreSetupStatus` reads `statusQuery.data` FIRST, so the
      // stale React Query entry — fetched moments earlier, while setup really
      // was incomplete — outranked the prime and kept winning. That single
      // stale `false` is what left a live store with every studio link but
      // Store disabled, and what kept the "Finish setting up your store" nudge
      // on the catalog after publishing.
      //
      // Write the known-good state through first so nothing observes a stale
      // `false`, then invalidate to reconcile with the server.
      primeStoreSetupStatusCache(true);
      invalidateRequireStoreSetupCache();
      queryClient.setQueryData<StoreStatusResponse | undefined>(
        queryKeys.store.status(),
        (previous) =>
          previous
            ? {
                ...previous,
                isSetupComplete: true,
                isPublished: true,
                isStoreOpen: true,
                missingFields: [],
              }
            : previous,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.store.status() });
      markStoreOpenPending(user?.id);
      
      // Clear the localStorage draft since setup is complete
      clearStoreProgressLocally(user?.id);
      
      // A notice, not a toast: publishing is the single most consequential
      // action in this flow and it is immediately followed by a navigation, so a
      // few-second toast on the outgoing page is the easiest thing in the app to
      // miss. The notice host is global, so it survives the redirect.
      showNotice({
        tone: 'success',
        title: 'Your store is live',
        message:
          'Buyers can find and browse your store now. Finish brand verification to start taking orders — only verified brands can receive them.',
        action: {
          label: 'Open verification',
          onSelect: () => navigate('/studio/verification'),
        },
      });
      navigate('/store/my');
    } catch (error) {
      console.error('Failed to publish store', error);
      const missingFields: string[] | undefined =
        // Common Nest error shape: { message, missingFields }
        (error as any)?.response?.data?.missingFields ??
        // Wrapped API shape: { data: { missingFields } }
        (error as any)?.response?.data?.data?.missingFields;

      if (Array.isArray(missingFields) && missingFields.length > 0) {
        toast.error(`Store setup incomplete: ${missingFields.join(', ')}`);
        // `businessHours` is fixable inside this wizard. Routing it to the
        // essentials page — which knows nothing about hours — would drop the
        // brand somewhere that cannot resolve the error it was just shown.
        if (missingFields.every((field) => field === 'businessHours')) {
          setCurrentStep('hours');
        } else {
          navigate('/studio/store/essentials', { replace: true });
        }
      } else {
        toast.error('Failed to publish store. Please try again.');
      }
      setSaveState('error');
    }
  }, [persistProgress, navigate, user?.id, queryClient]);

  // --- RENDER ---
  return (
    <div className="transition-colors">
      {/* Numbered across BOTH setup pages — see StoreSetupProgress. */}
      <StoreSetupProgress current={currentStep} className="mb-6" />

      {/* Social & Verification */}
      {currentStep === 'social' && (
        <StoreSocialStep
          data={wizardData}
          onChange={handleDataChange}
          onBack={goToPrevStep}
          onSkip={goToNextStep}
          onContinue={goToNextStep}
          isSaving={saveState === 'saving'}
        />
      )}

      {/* Policies */}
      {currentStep === 'policies' && (
        <StorePoliciesStep
          data={wizardData}
          onChange={handleDataChange}
          onBack={goToPrevStep}
          onContinue={goToNextStep}
          isSaving={saveState === 'saving'}
        />
      )}

      {/* Working hours (required) */}
      {currentStep === 'hours' && (
        <StoreHoursStep
          onBack={goToPrevStep}
          onContinue={goToNextStep}
          isSaving={saveState === 'saving'}
        />
      )}

      {/* Review & Publish */}
      {currentStep === 'review' && (
        <StoreReviewStep
          data={wizardData}
          onChange={handleDataChange}
          onBack={goToPrevStep}
          onSubmit={handlePublishStore}
          onGoToStep={goToStep}
          isSaving={saveState === 'saving'}
        />
      )}
    </div>
  );
};

export default StoreCreationWizard;

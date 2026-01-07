import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Step Components
import StoreBasicInfoStep from '@/components/store/wizard/StoreBasicInfoStep';
import StoreSocialStep from '@/components/store/wizard/StoreSocialStep';
import StorePoliciesStep from '@/components/store/wizard/StorePoliciesStep';
import StoreReviewStep from '@/components/store/wizard/StoreReviewStep';

// API
import {
  getStoreStatus,
  updateStoreProfile,
  getStoreWizardPrefill,
  openStore,
  type StoreProfileUpdateData,
  type StoreWizardPrefillResponse,
} from '@/api/StoreApi';

import type { StoreWizardData } from '@/types/storeWizard';

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

// All wizard steps in order (4 steps - catalog/media can be done from dashboard)
type WizardStep = 
  | 'basic-info'      // Step 1
  | 'social'          // Step 2
  | 'policies'        // Step 3
  | 'review';         // Step 4

const STEP_ORDER: WizardStep[] = [
  'basic-info',
  'social',
  'policies',
  'review',
];

type WizardSaveState = 'idle' | 'saving' | 'saved' | 'error';

const LOCAL_PROGRESS_KEY = 'store-progress';

const stepToNumber = (step: WizardStep): number => {
  return STEP_ORDER.indexOf(step) + 1;
};

/**
 * Store Creation Wizard
 * Full 6-step onboarding flow for brands to create their store
 */
const StoreCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  
  // Current step state
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic-info');
  const [wizardData, setWizardData] = useState<StoreWizardData>(initialData);
  const [hasLiveStore, setHasLiveStore] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<WizardSaveState>('idle');
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [systemCategories, setSystemCategories] = useState<StoreWizardPrefillResponse['system']['categories']>([]);
  
  // Refs for autosave
  const lastSavedPayloadRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // --- SAVE TO LOCAL STORAGE (Immediate, on every change) ---
  const saveToLocalStorage = useCallback(() => {
    try {
      const localData = {
        ...wizardData,
        step: stepToNumber(currentStep),
        savedAt: Date.now(),
      };
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(localData));
    } catch (error) {
      console.error('Failed to save to localStorage', error);
    }
  }, [wizardData, currentStep]);

  // Save to localStorage immediately when data or step changes
  useEffect(() => {
    if (!isLoadingDraft) {
      saveToLocalStorage();
    }
  }, [wizardData, currentStep, isLoadingDraft, saveToLocalStorage]);

  // --- API SAVE LOGIC (Debounced, for server sync) ---
  const buildSavePayload = useCallback(() => {
    const payload: StoreProfileUpdateData = {
      tagline: wizardData.tagline,
      description: wizardData.description,
      socialInstagram: wizardData.instagram,
      socialTiktok: wizardData.tiktok,
      socialTwitter: wizardData.twitter,
      socialWebsite: wizardData.website,
      contactEmail: wizardData.contactEmail,
      tags: wizardData.tags,
    };
    return payload;
  }, [wizardData]);

  const persistProgress = useCallback(
    async (reason?: string) => {
      const payload = buildSavePayload();
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedPayloadRef.current) return;

      setSaveState('saving');
      try {
        await updateStoreProfile(payload);
        lastSavedPayloadRef.current = serialized;
        setSaveState('saved');
      } catch (error) {
        console.error('Failed to save store progress', { reason, error });
        setSaveState('error');
      }
    },
    [buildSavePayload]
  );

  // --- HYDRATION ---
  useEffect(() => {
    let isCancelled = false;
    const hydrateDraft = async () => {
      setIsLoadingDraft(true);
      
      // Load local draft first
      const localDraftRaw = localStorage.getItem(LOCAL_PROGRESS_KEY) ?? localStorage.getItem('store-draft');
      let localDraft: Record<string, unknown> | null = null;
      try {
        localDraft = localDraftRaw ? JSON.parse(localDraftRaw) : null;
      } catch {
        localDraft = null;
      }

      // Start with initial data, then layer local draft on top
      let nextData: StoreWizardData = localDraft 
        ? { ...initialData, ...(localDraft as Partial<StoreWizardData>) }
        : initialData;

      // 1) Server store status - only override server-synced fields
      try {
        const response = await getStoreStatus();
        if (!isCancelled) {
          setHasLiveStore(Boolean(response?.isStoreOpen));
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
          setSystemCategories(prefill.system?.categories ?? []);
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
            tags: nextData.tags?.length ? nextData.tags : (prefill.brand.tags || []),
          };
        }
      } catch (error) {
        console.error('Failed to prefill wizard data', error);
      }

      if (!isCancelled) {
        setWizardData(nextData);
        console.log('[StoreWizard] Hydrated data:', nextData);
        console.log('[StoreWizard] Local draft step:', localDraft?.step);
        
        // Restore step from local draft (clamped to valid range)
        if (localDraft && typeof localDraft.step === 'number' && localDraft.step > 1) {
          // Clamp to valid step range (wizard was reduced from 6 to 4 steps)
          const clampedStepIndex = Math.min(localDraft.step - 1, STEP_ORDER.length - 1);
          const restoredStep = STEP_ORDER[clampedStepIndex];
          if (restoredStep) {
            setCurrentStep(restoredStep);
            toast.info(`Resuming from Step ${clampedStepIndex + 1}`);
          }
        }
        
        setIsLoadingDraft(false);
      }
    };

    hydrateDraft();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Redirect if user already has a live store
  useEffect(() => {
    if (hasLiveStore) {
      toast.error('You already have a live store.');
      navigate('/store/dashboard');
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
      // On step 1, back goes to profile
      navigate('/profile');
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
      
      // Call openStore API to mark setup as complete
      await openStore();
      
      // Clear the localStorage draft since setup is complete
      localStorage.removeItem(LOCAL_PROGRESS_KEY);
      
      toast.success('🎉 Your store is now live!');
      navigate('/store/my');
    } catch (error) {
      console.error('Failed to publish store', error);
      toast.error('Failed to publish store. Please try again.');
      setSaveState('error');
    }
  }, [persistProgress, navigate]);

  // --- RENDER ---
  return (
    <div className="transition-colors">
      {/* Step 1: Basic Info */}
      {currentStep === 'basic-info' && (
        <StoreBasicInfoStep
          data={wizardData}
          onChange={handleDataChange}
          availableCategories={systemCategories}
          onBack={goToPrevStep}
          onContinue={goToNextStep}
          saveState={saveState}
          isLoadingDraft={isLoadingDraft}
        />
      )}

      {/* Step 2: Social & Verification */}
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

      {/* Step 3: Policies */}
      {currentStep === 'policies' && (
        <StorePoliciesStep
          data={wizardData}
          onChange={handleDataChange}
          onBack={goToPrevStep}
          onContinue={goToNextStep}
          isSaving={saveState === 'saving'}
        />
      )}

      {/* Step 4: Review & Publish */}
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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StoreBasicInfoStep from '@/components/store/wizard/StoreBasicInfoStep';
import {
  getStoreStatus,
  updateStoreProfile,
  getStoreWizardPrefill,
  type StoreProfileUpdateData,
  type StoreWizardPrefillResponse,
} from '@/api/StoreApi';

import type { StoreWizardData } from '@/types/storeWizard';
const initialData: StoreWizardData = {
  // Step 1
  name: '',
  slug: '',
  categories: [],
  tagline: '',
  description: '',
  logoPreview: null,
  bannerPreview: null,
  
  // Step 2
  instagram: '',
  tiktok: '',
  twitter: '',
  website: '',
  tags: [],
  domainVerificationStatus: 'optional',
  
  // Step 3
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

  // Step 4
  products: [],
  collections: [],
  looks: [],
  catalogActiveTab: 'collections',

  // Step 5
  mediaItems: [],
  termsAccepted: false,
};

// Only Step 1 is currently implemented in the UI.
type WizardStep = 'basic-info';

type WizardSaveState = 'idle' | 'saving' | 'saved' | 'error';

const LOCAL_PROGRESS_KEY = 'store-progress';

const stepToNumber = (step: WizardStep): number => {
  void step;
  return 1;
};

/**
 * Store Creation Wizard
 * Multi-step onboarding flow for brands to create their store
 * Currently implements: Welcome screen + Basic Info (Step 1 of 6)
 */
const StoreCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep] = useState<WizardStep>('basic-info');
  const [wizardData, setWizardData] = useState<StoreWizardData>(initialData);
  const [hasLiveStore, setHasLiveStore] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<WizardSaveState>('idle');
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [systemCategories, setSystemCategories] = useState<StoreWizardPrefillResponse['system']['categories']>([]);
  const lastSavedPayloadRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const buildSavePayload = useCallback(
    () => {
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
    },
    [wizardData]
  );

  const persistProgress = useCallback(
    async (reason?: string) => {
      const payload = buildSavePayload();
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedPayloadRef.current) return;

      setSaveState('saving');
      try {
        await updateStoreProfile(payload);
        lastSavedPayloadRef.current = serialized;
        // Save local copy for fallback recovery
        localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify({
          ...wizardData,
          step: stepToNumber(currentStep),
        }));
        setSaveState('saved');
      } catch (error) {
        console.error('Failed to save store progress', { reason, error });
        setSaveState('error');
      }
    },
    [buildSavePayload, currentStep, wizardData]
  );

  useEffect(() => {
    let isCancelled = false;
    const hydrateDraft = async () => {
      setIsLoadingDraft(true);
      const localDraftRaw = localStorage.getItem(LOCAL_PROGRESS_KEY) ?? localStorage.getItem('store-draft');
      let localDraft: Record<string, unknown> | null = null;
      try {
        localDraft = localDraftRaw ? JSON.parse(localDraftRaw) : null;
      } catch {
        localDraft = null;
      }

      let nextData: StoreWizardData = initialData;

      // 1) Server store status (authoritative)
      try {
        const response = await getStoreStatus();
        if (!isCancelled) {
          setHasLiveStore(Boolean(response?.isStoreOpen));
        }

        // Hydrate from server profile
        if (response?.profile) {
          nextData = {
            ...nextData,
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
        } else if (localDraft) {
          // 2) Local draft fallback
          nextData = { ...nextData, ...(localDraft as Partial<StoreWizardData>) };
        }
      } catch (error) {
        console.error('Failed to load store status from server', error);
        if (localDraft) {
          nextData = { ...nextData, ...(localDraft as Partial<StoreWizardData>) };
        }
      }

      // 3) Prefill from canonical brand/profile data
      try {
        const prefill = await getStoreWizardPrefill();
        if (!isCancelled && prefill) {
          setSystemCategories(prefill.system?.categories ?? []);

          nextData = {
            ...nextData,
            // enforce canonical identity
            name: prefill.brand.storeName || nextData.name,
            slug: prefill.brand.slug || nextData.slug,

            // fill empty fields only
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
        try {
          const initialPayload = {
            name: nextData.name,
            slug: nextData.slug,
            categories: nextData.categories,
            tagline: nextData.tagline,
            description: nextData.description,
            instagram: nextData.instagram,
            tiktok: nextData.tiktok,
            twitter: nextData.twitter,
            website: nextData.website,
            contactEmail: nextData.contactEmail,
            tags: nextData.tags,
            step: stepToNumber('basic-info'),
          };
          lastSavedPayloadRef.current = JSON.stringify(initialPayload);
        } catch {
          // ignore
        }
        setIsLoadingDraft(false);
      }
    };

    hydrateDraft();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasLiveStore) {
      toast.error('User can only have one store at a time.');
      navigate('/profile');
    }
  }, [hasLiveStore, navigate]);

  // Auto-save: debounce on changes + periodic save
  useEffect(() => {
    if (isLoadingDraft) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistProgress('debounced');
    }, 900);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    wizardData.name,
    wizardData.slug,
    wizardData.categories,
    wizardData.tagline,
    wizardData.description,
    wizardData.instagram,
    wizardData.tiktok,
    wizardData.twitter,
    wizardData.website,
    wizardData.contactEmail,
    wizardData.tags,
    currentStep,
    isLoadingDraft,
    persistProgress,
  ]);

  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      void persistProgress('interval');
    }, 30_000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [persistProgress]);

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

  const handleBack = useCallback(() => {
    void currentStep;
    navigate('/profile');
  }, [currentStep, navigate]);

  const handleBasicInfoChange = useCallback((updates: Partial<StoreWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleContinue = useCallback(() => {
    void currentStep;
    toast.message('Next step is coming soon. Your updates save automatically.');
  }, [currentStep]);

  return (
    <div className="transition-colors">
      {currentStep === 'basic-info' && (
        <StoreBasicInfoStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          availableCategories={systemCategories}
          onBack={handleBack}
          onContinue={handleContinue}
          saveState={saveState}
          isLoadingDraft={isLoadingDraft}
        />
      )}
    </div>
  );
};

export default StoreCreationWizard;

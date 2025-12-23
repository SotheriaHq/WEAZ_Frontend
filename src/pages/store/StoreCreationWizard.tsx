import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StoreBasicInfoStep from '@/components/store/wizard/StoreBasicInfoStep';
import {
  getStoreDraftStatus,
  saveStoreDraft,
  getStoreWizardPrefill,
  type StoreDraftData,
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
    (stepOverride?: WizardStep) => {
      const step = stepOverride ?? currentStep;
      const payload: StoreDraftData & { step: number } = {
        name: wizardData.name,
        slug: wizardData.slug,
        categories: wizardData.categories,
        tagline: wizardData.tagline,
        description: wizardData.description,
        instagram: wizardData.instagram,
        tiktok: wizardData.tiktok,
        twitter: wizardData.twitter,
        website: wizardData.website,
        contactEmail: wizardData.contactEmail,
        tags: wizardData.tags,
        step: stepToNumber(step),
      };
      return payload;
    },
    [currentStep, wizardData]
  );

  const persistProgress = useCallback(
    async (reason?: string) => {
      const payload = buildSavePayload();
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedPayloadRef.current) return;

      setSaveState('saving');
      try {
        await saveStoreDraft(payload);
        lastSavedPayloadRef.current = serialized;
        localStorage.setItem(LOCAL_PROGRESS_KEY, serialized);
        setSaveState('saved');
      } catch (error) {
        console.error('Failed to save store progress', { reason, error });
        setSaveState('error');
      }
    },
    [buildSavePayload]
  );

  useEffect(() => {
    let isCancelled = false;
    const hydrateDraft = async () => {
      setIsLoadingDraft(true);
      const localDraftRaw = localStorage.getItem(LOCAL_PROGRESS_KEY) ?? localStorage.getItem('store-draft');
      let localDraft: Partial<StoreDraftData> | null = null;
      try {
        localDraft = localDraftRaw ? JSON.parse(localDraftRaw) : null;
      } catch {
        localDraft = null;
      }

      let nextData: StoreWizardData = initialData;

      // 1) Server draft (authoritative)
      try {
        const response = await getStoreDraftStatus();
        if (!isCancelled) {
          setHasLiveStore(Boolean(response?.hasLiveStore));
        }

        if (response?.hasDraft && response.draft?.data) {
          nextData = { ...nextData, ...(response.draft.data as any) };
        } else if (localDraft) {
          // 2) Local draft fallback
          nextData = { ...nextData, ...(localDraft as any) };
        }
      } catch (error) {
        console.error('Failed to load store draft from server', error);
        if (localDraft) {
          nextData = { ...nextData, ...(localDraft as any) };
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
            ...buildSavePayload('basic-info'),
            ...{
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
              step: stepToNumber(currentStep),
            },
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

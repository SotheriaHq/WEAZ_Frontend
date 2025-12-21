import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StoreWelcomeScreen from '@/components/store/wizard/StoreWelcomeScreen';
import StoreBasicInfoStep from '@/components/store/wizard/StoreBasicInfoStep';
import StoreSocialStep from '@/components/store/wizard/StoreSocialStep';
import StorePoliciesStep from '@/components/store/wizard/StorePoliciesStep';
import StoreCatalogStep from '@/components/store/wizard/StoreCatalogStep';
import CreateCollectionModal from '@/components/store/wizard/CreateCollectionModal';
import CreateLookModal from '@/components/store/wizard/CreateLookModal';
import StoreMediaReviewStep from '@/components/store/wizard/StoreMediaReviewStep';
import StoreReviewStep from '@/components/store/wizard/StoreReviewStep';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  getStoreDraftStatus,
  saveStoreDraft,
  clearStoreDraft,
  getStoreWizardPrefill,
  type StoreDraftData,
  type StoreWizardPrefillResponse,
} from '@/api/StoreApi';

import type { StoreWizardData, WizardCollection, WizardLook } from '@/types/storeWizard';
const initialData: StoreWizardData = {
  // Step 1
  name: '',
  slug: '',
  categories: [],
  tagline: '',
  description: '',
  
  // Step 2
  instagram: '',
  tiktok: '',
  twitter: '',
  website: '',
  tags: [],
  domainVerificationStatus: 'optional',
  
  // Step 3
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

type WizardStep = 'welcome' | 'basic-info' | 'social' | 'policies' | 'catalog' | 'media' | 'review';

const WIZARD_STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'welcome', label: 'Welcome', description: 'Preview requirements' },
  { id: 'basic-info', label: 'Basics', description: 'Name, slug, category' },
  { id: 'social', label: 'Socials', description: 'Handles & trust' },
  { id: 'policies', label: 'Policies', description: 'Shipping, returns, size' },
  { id: 'catalog', label: 'Catalog', description: 'Products & collections' },
  { id: 'media', label: 'Media', description: 'Quality check' },
  { id: 'review', label: 'Review', description: 'Submit for approval' },
];

/**
 * Store Creation Wizard
 * Multi-step onboarding flow for brands to create their store
 * Currently implements: Welcome screen + Basic Info (Step 1 of 6)
 */
const StoreCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [wizardData, setWizardData] = useState<StoreWizardData>(initialData);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [hasLiveStore, setHasLiveStore] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isLookModalOpen, setIsLookModalOpen] = useState(false);
  const [showDeleteDraftConfirm, setShowDeleteDraftConfirm] = useState(false);
  const [systemCategories, setSystemCategories] = useState<StoreWizardPrefillResponse['system']['categories']>([]);
  const resolvedStepIndex = WIZARD_STEPS.findIndex((step) => step.id === currentStep);
  const currentStepIndex = resolvedStepIndex === -1 ? 0 : resolvedStepIndex;
  void currentStepIndex;

  useEffect(() => {
    let isCancelled = false;
    const hydrateDraft = async () => {
      setIsLoadingDraft(true);
      const localDraftRaw = localStorage.getItem('store-draft');
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
          if (!isCancelled) setHasDraft(true);
        } else if (localDraft) {
          // 2) Local draft fallback
          nextData = { ...nextData, ...(localDraft as any) };
          if (!isCancelled) setHasDraft(true);
        }
      } catch (error) {
        console.error('Failed to load store draft from server', error);
        if (localDraft) {
          nextData = { ...nextData, ...(localDraft as any) };
          if (!isCancelled) setHasDraft(true);
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
        setIsLoadingDraft(false);
      }
    };

    hydrateDraft();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleGetStarted = useCallback(() => {
    if (hasLiveStore) {
      toast.error('User can only have one store at a time.');
      navigate('/profile');
      return;
    }
    setCurrentStep('basic-info');
  }, [hasLiveStore, navigate]);

  const handleResumeDraft = useCallback(() => {
    setCurrentStep('basic-info');
  }, []);

  const handleStartFresh = useCallback(() => {
    setShowDeleteDraftConfirm(true);
  }, []);

  const handleConfirmDeleteDraft = useCallback(async () => {
    setShowDeleteDraftConfirm(false);
    try {
      await clearStoreDraft();
      localStorage.removeItem('store-draft');
      setWizardData(initialData);
      setHasDraft(false);
      toast.success('Draft deleted. Intiate a new store creation.');
      setCurrentStep('basic-info');
    } catch (error) {
      console.error('Failed to clear store draft', error);
      toast.error('Could not delete draft right now.');
    }
  }, []);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'basic-info':
        setCurrentStep('welcome');
        break;
      case 'social':
        setCurrentStep('basic-info');
        break;
      case 'policies':
        setCurrentStep('social');
        break;
      case 'catalog':
        setCurrentStep('policies');
        break;
      case 'media':
        setCurrentStep('catalog');
        break;
      case 'review':
        setCurrentStep('media');
        break;
      default:
        navigate('/profile');
    }
  }, [currentStep, navigate]);

  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    try {
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
        step: currentStep === 'welcome' ? 0 : 1,
      };

      await saveStoreDraft(payload);

      setWizardData((prev) => ({
        ...prev,
        ...payload,
      }));

      localStorage.setItem('store-draft', JSON.stringify(payload));
      setHasDraft(true);
      toast.success('Draft saved');
    } catch (error) {
      console.error('Failed to save store draft', error);
      toast.error('Unable to save draft right now');
    } finally {
      setIsSavingDraft(false);
    }
  }, [wizardData, currentStep]);

  const handleBasicInfoChange = useCallback((updates: Partial<StoreWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleContinue = useCallback(() => {
    // Navigate to next step without saving draft or showing toast
    switch (currentStep) {
      case 'basic-info':
        setCurrentStep('social');
        break;
      case 'social':
        setCurrentStep('policies');
        break;
      case 'policies':
        setCurrentStep('catalog');
        break;
      case 'catalog':
        setCurrentStep('media');
        break;
      case 'media':
        setCurrentStep('review');
        break;
      case 'review':
        // Final submit handled separately
        break;
    }
  }, [currentStep]);

  const handleSkipSocial = useCallback(() => {
    setCurrentStep('policies');
  }, []);

  // Catalog step handlers
  const handleOpenCreateCollection = useCallback(() => {
    setIsCollectionModalOpen(true);
  }, []);

  const handleCloseCreateCollection = useCallback(() => {
    setIsCollectionModalOpen(false);
  }, []);

  const handleSaveCollection = useCallback((collection: WizardCollection) => {
    setWizardData((prev) => ({
      ...prev,
      collections: [...prev.collections, collection],
    }));
    setIsCollectionModalOpen(false);
  }, []);

  const handleOpenAddProduct = useCallback(() => {
    navigate('/studio/products/create', {
      state: { from: '/store/create', source: 'store-wizard' },
    });
  }, [navigate]);

  // Look modal handlers
  const handleOpenCreateLook = useCallback(() => {
    setIsLookModalOpen(true);
  }, []);

  const handleCloseCreateLook = useCallback(() => {
    setIsLookModalOpen(false);
  }, []);

  const handleSaveLook = useCallback((look: WizardLook) => {
    setWizardData((prev) => ({
      ...prev,
      looks: [...prev.looks, look],
    }));
    setIsLookModalOpen(false);
  }, []);

  // Final submit handler
  const handleSubmitStore = useCallback(async () => {
    toast.success('Store submitted for review!');
    // TODO: Implement actual submission
    navigate('/profile');
  }, [navigate]);

  return (
    <div className="transition-colors">
      {currentStep === 'welcome' && (
        <StoreWelcomeScreen
          onGetStarted={handleGetStarted}
          onResumeDraft={hasDraft ? handleResumeDraft : undefined}
          onStartFresh={hasDraft ? handleStartFresh : undefined}
          hasDraft={hasDraft}
          hasLiveStore={hasLiveStore}
        />
      )}

      {currentStep === 'basic-info' && (
        <StoreBasicInfoStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          availableCategories={systemCategories}
          onBack={handleBack}
          onSaveDraft={handleSaveDraft}
          onContinue={handleContinue}
          isSavingDraft={isSavingDraft}
          isLoadingDraft={isLoadingDraft}
        />
      )}

      {currentStep === 'social' && (
        <StoreSocialStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          onBack={handleBack}
          onSkip={handleSkipSocial}
          onContinue={handleContinue}
          isSaving={isSavingDraft}
        />
      )}

      {currentStep === 'policies' && (
        <StorePoliciesStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          onBack={handleBack}
          onContinue={handleContinue}
          isSaving={isSavingDraft}
        />
      )}

      {currentStep === 'catalog' && (
        <>
          <StoreCatalogStep
            data={wizardData}
            onChange={handleBasicInfoChange}
            onBack={handleBack}
            onContinue={handleContinue}
            onOpenCreateCollection={handleOpenCreateCollection}
            onOpenAddProduct={handleOpenAddProduct}
            isSaving={isSavingDraft}
          />
          <CreateCollectionModal
            isOpen={isCollectionModalOpen}
            onClose={handleCloseCreateCollection}
            onSave={handleSaveCollection}
            availableProducts={wizardData.products}
          />
          <CreateLookModal
            isOpen={isLookModalOpen}
            onClose={handleCloseCreateLook}
            onSave={handleSaveLook}
            availableProducts={wizardData.products}
          />
        </>
      )}

      {currentStep === 'media' && (
        <StoreMediaReviewStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          onBack={handleBack}
          onContinue={handleContinue}
          isSaving={isSavingDraft}
        />
      )}

      {currentStep === 'review' && (
        <StoreReviewStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          onBack={handleBack}
          onSubmit={handleSubmitStore}
          onSaveDraft={handleSaveDraft}
          isSaving={isSavingDraft}
        />
      )}

      {/* Delete Draft Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDraftConfirm}
        title="Delete Draft?"
        message="This will permanently delete your saved draft and you'll start from scratch. This action cannot be undone."
        confirmText="Delete Draft"
        cancelText="Keep Draft"
        isDestructive
        onConfirm={handleConfirmDeleteDraft}
        onCancel={() => setShowDeleteDraftConfirm(false)}
      />
    </div>
  );
};

export default StoreCreationWizard;

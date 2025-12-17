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
import { getStoreDraftStatus, saveStoreDraft, clearStoreDraft, type StoreDraftData } from '@/api/StoreApi';

// Catalog types for wizard
export interface WizardProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
}

export interface WizardCollection {
  id: string;
  name: string;
  description?: string;
  coverImage: string;
  type: 'standard' | 'seasonal' | 'limited' | 'capsule';
  productIds: string[];
  featured: boolean;
  status: 'active' | 'inactive';
  launchDate?: string;
  quantityCap?: number;
}

export interface WizardLook {
  id: string;
  name: string;
  description?: string;
  image: string;
  styledBy: string;
  productIds: string[];
  hotspots: { x: number; y: number; productId: string }[];
  featured: boolean;
  allowSizeSwap: boolean;
  discount: number; // percentage
}

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  resolution: string;
  status: 'passed' | 'failed' | 'warning';
  issues?: { type: string; message: string }[];
}

export interface StoreWizardData {
  // Step 1: Basic Info
  name: string;
  slug: string;
  categories: string[]; // Changed to array for multi-select (max 3)
  tagline: string;
  description: string;

  // Step 2: Social & Verification
  instagram: string;
  tiktok: string;
  twitter: string;
  website: string;
  domainVerificationStatus: 'unverified' | 'pending' | 'verified';
  domainVerificationToken: string;

  // Step 3: Policies
  shippingRegions: string[];
  processingTime: string;
  shippingMethods: string[];
  freeShippingThreshold: number | null;
  returnsAccepted: boolean;
  returnWindow: string;
  returnConditions: string[];
  refundMethod: string;
  sizeChartFile: File | null;
  sizeChartUrl: string | null;
  responseTimeSla: string;
  contactEmail: string;

  // Step 4: Catalog
  products: WizardProduct[];
  collections: WizardCollection[];
  looks: WizardLook[];
  catalogActiveTab: 'collections' | 'looks';

  // Step 5: Media
  mediaItems: MediaItem[];
  termsAccepted: boolean;
}

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
  domainVerificationStatus: 'unverified',
  domainVerificationToken: '',

  // Step 3
  shippingRegions: [],
  processingTime: '',
  shippingMethods: [],
  freeShippingThreshold: null,
  returnsAccepted: true,
  returnWindow: '14',
  returnConditions: [],
  refundMethod: 'original',
  sizeChartFile: null,
  sizeChartUrl: null,
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

      try {
        const response = await getStoreDraftStatus();
        if (!isCancelled) {
          setHasLiveStore(Boolean(response?.hasLiveStore));
        }

        if (!isCancelled && response?.hasDraft && response.draft?.data) {
          const data = response.draft.data;
          setWizardData((prev) => ({
            ...prev,
            ...data,
          }));
          setHasDraft(true);
          if (!isCancelled) {
            setIsLoadingDraft(false);
          }
          return;
        }
      } catch (error) {
        console.error('Failed to load store draft from server', error);
      }

      if (!isCancelled && localDraft) {
        setWizardData((prev) => ({
          ...prev,
          ...localDraft,
        } as StoreWizardData));
        setHasDraft(true);
      }
      if (!isCancelled) {
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
      toast.error('You already have a store. Store creation is disabled.');
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
      toast.success('Draft deleted. Start fresh.');
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
    // TODO: Open add product modal/flow
    toast.info('Add Product flow coming soon!');
  }, []);

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

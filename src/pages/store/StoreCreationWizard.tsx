import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StoreWelcomeScreen from '@/components/store/wizard/StoreWelcomeScreen';
import StoreBasicInfoStep from '@/components/store/wizard/StoreBasicInfoStep';

export interface StoreWizardData {
  // Step 1: Basic Info
  name: string;
  slug: string;
  categories: string[]; // Changed to array for multi-select (max 3)
  tagline: string;
  description: string;
  logoFile: File | null;
  logoPreview: string | null;
  bannerFile: File | null;
  bannerPreview: string | null;
}

const initialData: StoreWizardData = {
  name: '',
  slug: '',
  categories: [], // Array for multi-select
  tagline: '',
  description: '',
  logoFile: null,
  logoPreview: null,
  bannerFile: null,
  bannerPreview: null,
};

type WizardStep = 'welcome' | 'basic-info';

/**
 * Store Creation Wizard
 * Multi-step onboarding flow for brands to create their store
 * Currently implements: Welcome screen + Basic Info (Step 1 of 6)
 */
const StoreCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [wizardData, setWizardData] = useState<StoreWizardData>(initialData);

  // Check for existing draft in localStorage
  const hasDraft = Boolean(localStorage.getItem('store-draft'));

  const handleGetStarted = useCallback(() => {
    setCurrentStep('basic-info');
  }, []);

  const handleResumeDraft = useCallback(() => {
    const draft = localStorage.getItem('store-draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setWizardData(prev => ({ ...prev, ...parsed }));
      } catch {
        // Invalid draft, ignore
      }
    }
    setCurrentStep('basic-info');
  }, []);

  const handleBack = useCallback(() => {
    if (currentStep === 'basic-info') {
      setCurrentStep('welcome');
    } else {
      navigate('/profile');
    }
  }, [currentStep, navigate]);

  const handleSaveDraft = useCallback(() => {
    const draftData = { ...wizardData };
    // Don't save files to localStorage, only metadata
    const savable = {
      name: draftData.name,
      slug: draftData.slug,
      categories: draftData.categories,
      tagline: draftData.tagline,
      description: draftData.description,
    };
    localStorage.setItem('store-draft', JSON.stringify(savable));
  }, [wizardData]);

  const handleBasicInfoChange = useCallback((updates: Partial<StoreWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleContinue = useCallback(() => {
    // For now, just save draft - future steps will be added
    handleSaveDraft();
    // TODO: Navigate to next step when implemented
  }, [handleSaveDraft]);

  return (
    <div className="transition-colors">
      {currentStep === 'welcome' && (
        <StoreWelcomeScreen
          onGetStarted={handleGetStarted}
          onResumeDraft={hasDraft ? handleResumeDraft : undefined}
        />
      )}

      {currentStep === 'basic-info' && (
        <StoreBasicInfoStep
          data={wizardData}
          onChange={handleBasicInfoChange}
          onBack={handleBack}
          onSaveDraft={handleSaveDraft}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
};

export default StoreCreationWizard;

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import StorePoliciesStep from '@/components/store/wizard/StorePoliciesStep';
import type { StoreWizardData } from '@/types/storeWizard';
import {
  getStoreGeneralSettings,
  getStorePolicies,
  updateStorePolicies,
  updateStoreProfile,
} from '@/api/StoreApi';

const initialPolicyData: StoreWizardData = {
  name: '',
  slug: '',
  categories: [],
  tagline: '',
  description: '',
  instagram: '',
  tiktok: '',
  twitter: '',
  website: '',
  tags: [],
  domainVerificationStatus: 'optional',
  shippingRegions: [],
  processingTime: '',
  shippingMethods: [],
  freeShippingThreshold: null,
  shippingMethod: 'standard',
  shippingRates: [],
  orderProcessingMode: 'manual-review',
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
  customOrderConsultationMode: 'required',
  customOrderLeadTime: '14-21',
  customOrderRushSupported: false,
  products: [],
  collections: [],
  looks: [],
  catalogActiveTab: 'collections',
  mediaItems: [],
  termsAccepted: false,
};

const StorePoliciesSettings: React.FC = () => {
  const [data, setData] = useState<StoreWizardData>(initialPolicyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [policies, settings] = await Promise.all([
          getStorePolicies(),
          getStoreGeneralSettings(),
        ]);

        if (cancelled) return;

        setData((prev) => ({
          ...prev,
          contactEmail: settings.contactEmail || prev.contactEmail,
          shippingRegions: policies.shippingRegions || prev.shippingRegions,
          processingTime: policies.processingTime || prev.processingTime,
          shippingMethods: policies.shippingMethods || prev.shippingMethods,
          freeShippingThreshold:
            policies.freeShippingThreshold !== null && policies.freeShippingThreshold !== undefined
              ? policies.freeShippingThreshold
              : prev.freeShippingThreshold,
          returnsAccepted:
            typeof policies.returnsAccepted === 'boolean'
              ? policies.returnsAccepted
              : prev.returnsAccepted,
          returnWindow: policies.returnWindow || prev.returnWindow,
          returnConditions: policies.returnConditions || prev.returnConditions,
          refundMethod: policies.refundMethod || prev.refundMethod,
          responseTimeSla: policies.responseTimeSla || prev.responseTimeSla,
          sizeChartUrl: policies.sizeChart?.url ?? prev.sizeChartUrl,
          sizeChartPresetKey: policies.sizeChart?.presetKey ?? prev.sizeChartPresetKey,
          sizeChartSystem: policies.sizeChart?.system ?? prev.sizeChartSystem,
          shippingRates: Array.isArray(policies.shippingRules?.shippingRates)
            ? policies.shippingRules?.shippingRates
            : prev.shippingRates,
          shippingMethod: policies.shippingRules?.shippingMethod || prev.shippingMethod,
          orderProcessingMode:
            policies.shippingRules?.orderSettings?.orderProcessingMode || prev.orderProcessingMode,
          orderCancellationWindow:
            policies.shippingRules?.orderSettings?.orderCancellationWindow || prev.orderCancellationWindow,
          allowOrderNotes:
            typeof policies.shippingRules?.orderSettings?.allowOrderNotes === 'boolean'
              ? policies.shippingRules.orderSettings.allowOrderNotes
              : prev.allowOrderNotes,
          customOrdersEnabled:
            typeof policies.shippingRules?.customOrderSettings?.customOrdersEnabled === 'boolean'
              ? policies.shippingRules.customOrderSettings.customOrdersEnabled
              : prev.customOrdersEnabled,
          customOrderConsultationMode:
            policies.shippingRules?.customOrderSettings?.consultationMode ||
            prev.customOrderConsultationMode,
          customOrderLeadTime:
            policies.shippingRules?.customOrderSettings?.leadTime || prev.customOrderLeadTime,
          customOrderRushSupported:
            typeof policies.shippingRules?.customOrderSettings?.rushSupported === 'boolean'
              ? policies.shippingRules.customOrderSettings.rushSupported
              : prev.customOrderRushSupported,
        }));
      } catch (error) {
        console.error('Failed to load store policies', error);
        toast.error('Failed to load store policies. Please refresh and try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback((updates: Partial<StoreWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const hasSizeChart = Boolean(data.sizeChartUrl || data.sizeChartPresetKey);
    const sizeChart = hasSizeChart
      ? {
          url: data.sizeChartUrl,
          presetKey: data.sizeChartPresetKey,
          system: data.sizeChartSystem,
        }
      : null;

    const hasShippingRules = Boolean(
      (data.shippingRates && data.shippingRates.length > 0) || data.shippingMethod
    );
    const shippingRules = hasShippingRules
      ? {
          shippingRates: data.shippingRates,
          shippingMethod: data.shippingMethod,
          orderSettings: {
            orderProcessingMode: data.orderProcessingMode,
            orderCancellationWindow: data.orderCancellationWindow,
            allowOrderNotes: data.allowOrderNotes,
          },
          customOrderSettings: {
            customOrdersEnabled: data.customOrdersEnabled,
            consultationMode: data.customOrderConsultationMode,
            leadTime: data.customOrderLeadTime,
            rushSupported: data.customOrderRushSupported,
          },
        }
      : null;

    try {
      await Promise.all([
        updateStorePolicies({
          shippingRegions: data.shippingRegions,
          processingTime: data.processingTime,
          shippingMethods: data.shippingMethods,
          freeShippingThreshold: data.freeShippingThreshold,
          returnsAccepted: data.returnsAccepted,
          returnWindow: data.returnWindow,
          returnConditions: data.returnConditions,
          refundMethod: data.refundMethod,
          responseTimeSla: data.responseTimeSla,
          sizeChart,
          shippingRules,
        }),
        updateStoreProfile({ contactEmail: data.contactEmail }),
      ]);
      toast.success('Store policies updated.');
    } catch (error) {
      console.error('Failed to update store policies', error);
      toast.error('Failed to update store policies. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-6 text-sm text-gray-500 dark:text-gray-400">
        Loading store policies...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Store Policies
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure shipping, returns, size charts, and response commitments.
        </p>
      </div>
      <StorePoliciesStep
        data={data}
        onChange={handleChange}
        onBack={() => {}}
        onContinue={handleSave}
        isSaving={isSaving}
        mode="settings"
        primaryActionLabel={isSaving ? 'Saving...' : 'Save Policies'}
      />
    </div>
  );
};

export default StorePoliciesSettings;

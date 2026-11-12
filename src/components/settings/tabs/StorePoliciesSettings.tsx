import { useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RootState } from '@/store';
import { getActiveBrandId } from '@/lib/brandAccess';
import { queryKeys } from '@/query/queryKeys';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import StorePoliciesStep from '@/components/store/wizard/StorePoliciesStep';
import type { StoreWizardData } from '@/types/storeWizard';
import {
  getStoreGeneralSettings,
  getStorePolicies,
  updateStorePolicies,
  updateStoreProfile,
} from '@/api/StoreApi';
import {
  sanitizeCustomOrderLeadTime,
  sanitizeProcessingTime,
  sanitizeResponseTimeSla,
  sanitizeReturnWindow,
  sanitizeShippingRegions,
} from '@/utils/storePolicyConstraints';

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
  products: [],
  collections: [],
  looks: [],
  catalogActiveTab: 'collections',
  mediaItems: [],
  termsAccepted: false,
};

const StorePoliciesSettingsContent: React.FC = () => {
  const [data, setData] = useState<StoreWizardData>(initialPolicyData);
  const actor = useSelector((state: RootState) => state.user.profile);
  const client = useQueryClient();
  const brandId = getActiveBrandId(actor);
  const policiesKey = queryKeys.store.policies(actor?.id, brandId);
  const generalKey = queryKeys.store.generalSettings(actor?.id, brandId);
  const policiesResource = useQuery({ queryKey: policiesKey, enabled: Boolean(actor?.id && brandId), refetchOnMount: true, queryFn: ({ signal }) => getStorePolicies({ signal, expectedBrandId: brandId }), select: (value) => value.brandId === brandId ? value : undefined });
  const generalResource = useQuery({ queryKey: generalKey, enabled: Boolean(actor?.id && brandId), refetchOnMount: true, queryFn: ({ signal }) => getStoreGeneralSettings({ signal, expectedBrandId: brandId }), select: (value) => value.brandId === brandId ? value : undefined });
  const isLoading = !policiesResource.data || !generalResource.data;
  const dirty = useRef(false);
  const editRevision = useRef(0);
  const [isSaving, setIsSaving] = useState(false);

  useLayoutEffect(() => {
    const policies = policiesResource.data;
    const settings = generalResource.data;
    if (!policies || !settings || dirty.current) return;
        setData(() => ({
          ...initialPolicyData,
          contactEmail: settings.contactEmail || initialPolicyData.contactEmail,
          shippingRegions: sanitizeShippingRegions(policies.shippingRegions || initialPolicyData.shippingRegions),
          processingTime: sanitizeProcessingTime(policies.processingTime || initialPolicyData.processingTime),
          shippingMethods: policies.shippingMethods || initialPolicyData.shippingMethods,
          freeShippingThreshold:
            policies.freeShippingThreshold !== null && policies.freeShippingThreshold !== undefined
              ? policies.freeShippingThreshold
              : initialPolicyData.freeShippingThreshold,
          returnsAccepted:
            typeof policies.returnsAccepted === 'boolean'
              ? policies.returnsAccepted
              : initialPolicyData.returnsAccepted,
          returnWindow: sanitizeReturnWindow(policies.returnWindow || initialPolicyData.returnWindow),
          returnConditions: policies.returnConditions || initialPolicyData.returnConditions,
          refundMethod: policies.refundMethod || initialPolicyData.refundMethod,
          responseTimeSla: sanitizeResponseTimeSla(policies.responseTimeSla || initialPolicyData.responseTimeSla),
          sizeChartUrl: policies.sizeChart?.url ?? initialPolicyData.sizeChartUrl,
          sizeChartPresetKey: policies.sizeChart?.presetKey ?? initialPolicyData.sizeChartPresetKey,
          sizeChartSystem: policies.sizeChart?.system ?? initialPolicyData.sizeChartSystem,
          shippingRates: Array.isArray(policies.shippingRules?.shippingRates)
            ? policies.shippingRules?.shippingRates
            : initialPolicyData.shippingRates,
          shippingMethod: policies.shippingRules?.shippingMethod || initialPolicyData.shippingMethod,
          orderProcessingMode:
            policies.shippingRules?.orderSettings?.orderProcessingMode || initialPolicyData.orderProcessingMode,
          orderCancellationWindow:
            policies.shippingRules?.orderSettings?.orderCancellationWindow || initialPolicyData.orderCancellationWindow,
          allowOrderNotes:
            typeof policies.shippingRules?.orderSettings?.allowOrderNotes === 'boolean'
              ? policies.shippingRules.orderSettings.allowOrderNotes
              : initialPolicyData.allowOrderNotes,
          customOrdersEnabled:
            typeof policies.shippingRules?.customOrderSettings?.customOrdersEnabled === 'boolean'
              ? policies.shippingRules.customOrderSettings.customOrdersEnabled
              : initialPolicyData.customOrdersEnabled,
          customOrderLeadTime: sanitizeCustomOrderLeadTime(
            policies.shippingRules?.customOrderSettings?.leadTime || initialPolicyData.customOrderLeadTime,
          ),
          customOrderRushSupported:
            typeof policies.shippingRules?.customOrderSettings?.rushSupported === 'boolean'
              ? policies.shippingRules.customOrderSettings.rushSupported
              : initialPolicyData.customOrderRushSupported,
        }));
  }, [policiesResource.data, generalResource.data]);

  const handleChange = useCallback((updates: Partial<StoreWizardData>) => {
    dirty.current = true;
    editRevision.current += 1;
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = useCallback(async () => {
    const savedRevision = editRevision.current;
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
            leadTime: data.customOrderLeadTime,
            rushSupported: data.customOrderRushSupported,
          },
        }
      : null;

    try {
      const writes = await Promise.allSettled([
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
      const failedWrite = writes.find((result) => result.status === 'rejected');
      if (failedWrite?.status === 'rejected') throw failedWrite.reason;
      if (editRevision.current === savedRevision) dirty.current = false;
      toast.success('Store policies updated.');
    } catch {
      toast.error('Failed to update store policies. Please try again.');
    } finally {
      setIsSaving(false);
      // Re-read both resources even after a partial failure; never invent a saved state.
      void client.invalidateQueries({ queryKey: policiesKey });
      void client.invalidateQueries({ queryKey: generalKey });
      void client.invalidateQueries({ queryKey: queryKeys.store.status(actor?.id, brandId) });
    }
  }, [data, client, actor?.id, brandId, policiesKey, generalKey]);

  if ((!policiesResource.data || !generalResource.data) && (policiesResource.error || generalResource.error)) {
    return <div role="alert" className="space-y-4">
      <p>We could not load your saved policies. Please retry before editing.</p>
      <button type="button" className="rounded-xl bg-primary px-4 py-3 text-white" onClick={() => { void policiesResource.refetch(); void generalResource.refetch(); }}>Retry policies</button>
    </div>;
  }

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

export default function StorePoliciesSettings() {
  const actor = useSelector((state: RootState) => state.user.profile);
  return <StorePoliciesSettingsContent key={JSON.stringify([actor?.id, getActiveBrandId(actor)])} />;
}

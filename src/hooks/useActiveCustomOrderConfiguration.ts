import { useMemo } from 'react';
import type { CustomOrderConfiguration, CustomOrderSourceType } from '@/api/CustomOrderApi';
import { useActiveCustomOrderConfigurationQuery } from '@/query/queries';

type ActiveCustomOrderConfigurationState = {
  configuration: CustomOrderConfiguration | null;
  configurationId: string | null;
  isLoading: boolean;
  isAvailable: boolean;
  unavailableReason: string | null;
};

export const useActiveCustomOrderConfiguration = (params: {
  sourceType: CustomOrderSourceType;
  sourceId?: string | null;
  enabled?: boolean;
  unavailableReason?: string;
}): ActiveCustomOrderConfigurationState => {
  const shouldLoad = Boolean(params.enabled && params.sourceId);
  const configurationQuery = useActiveCustomOrderConfigurationQuery(params.sourceType, params.sourceId, {
    enabled: shouldLoad,
  });

  return useMemo<ActiveCustomOrderConfigurationState>(() => {
    if (!shouldLoad) {
      return {
        configuration: null,
        configurationId: null,
        isLoading: false,
        isAvailable: false,
        unavailableReason: null,
      };
    }

    if (configurationQuery.isFetching && !configurationQuery.data) {
      return {
        configuration: null,
        configurationId: null,
        isLoading: true,
        isAvailable: false,
        unavailableReason: null,
      };
    }

    const configuration = configurationQuery.data ?? null;
    if (configuration?.id) {
      return {
        configuration,
        configurationId: configuration.id,
        isLoading: false,
        isAvailable: true,
        unavailableReason: null,
      };
    }

    return {
      configuration: null,
      configurationId: null,
      isLoading: false,
      isAvailable: false,
      unavailableReason:
        params.unavailableReason ??
        'This item is marked custom-order enabled, but it is not configured for custom bagging yet.',
    };
  }, [
    configurationQuery.data,
    configurationQuery.isFetching,
    params.unavailableReason,
    shouldLoad,
  ]);
};

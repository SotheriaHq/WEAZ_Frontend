import { useEffect, useState } from 'react';
import {
  customOrderConfigurationsApi,
  type CustomOrderConfiguration,
  type CustomOrderSourceType,
} from '@/api/CustomOrderApi';

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
  const [state, setState] = useState<ActiveCustomOrderConfigurationState>({
    configuration: null,
    configurationId: null,
    isLoading: false,
    isAvailable: false,
    unavailableReason: null,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!params.enabled || !params.sourceId) {
        if (!active) return;
        setState({
          configuration: null,
          configurationId: null,
          isLoading: false,
          isAvailable: false,
          unavailableReason: null,
        });
        return;
      }

      setState({
        configuration: null,
        configurationId: null,
        isLoading: true,
        isAvailable: false,
        unavailableReason: null,
      });

      try {
        const configuration =
          params.sourceType === 'PRODUCT'
            ? await customOrderConfigurationsApi.getActiveForProduct(params.sourceId)
            : await customOrderConfigurationsApi.getActiveForDesign(params.sourceId);

        if (!active) return;

        if (configuration?.id) {
          setState({
            configuration,
            configurationId: configuration.id,
            isLoading: false,
            isAvailable: true,
            unavailableReason: null,
          });
          return;
        }

        setState({
          configuration: null,
          configurationId: null,
          isLoading: false,
          isAvailable: false,
          unavailableReason:
            params.unavailableReason ??
            'This item is marked custom-order enabled, but it is not configured for custom bagging yet.',
        });
      } catch {
        if (!active) return;
        setState({
          configuration: null,
          configurationId: null,
          isLoading: false,
          isAvailable: false,
          unavailableReason:
            params.unavailableReason ??
            'This item is marked custom-order enabled, but it is not configured for custom bagging yet.',
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [params.enabled, params.sourceId, params.sourceType, params.unavailableReason]);

  return state;
};
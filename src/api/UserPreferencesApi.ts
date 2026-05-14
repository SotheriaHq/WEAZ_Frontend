import { apiClient } from './httpClient';
import { unwrapApiResponse, type ApiSuccessPayload, type AuthUserDto } from '@/types/auth';
import { normalizeThemePreference, type ThemePreference } from '@/types/theme';

type ThemePreferenceResponse =
  | { themePreference?: unknown }
  | { user?: AuthUserDto | ({ themePreference?: unknown } & Record<string, unknown>) };

const readThemePreference = (
  payload: ThemePreferenceResponse,
  fallback: ThemePreference,
): ThemePreference => {
  if ('themePreference' in payload) {
    return normalizeThemePreference(payload.themePreference, fallback);
  }

  if ('user' in payload && payload.user && typeof payload.user === 'object') {
    return normalizeThemePreference(
      (payload.user as { themePreference?: unknown }).themePreference,
      fallback,
    );
  }

  return fallback;
};

export class UserPreferencesApi {
  static async updateThemePreference(
    themePreference: ThemePreference,
  ): Promise<{ themePreference: ThemePreference }> {
    const response = await apiClient.patch('/users/me/preferences', { themePreference });
    const payload = unwrapApiResponse<ThemePreferenceResponse>(
      response.data as ApiSuccessPayload<ThemePreferenceResponse>,
    );

    return {
      themePreference: readThemePreference(payload, themePreference),
    };
  }
}

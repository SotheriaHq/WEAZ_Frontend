import { apiClient } from './httpClient';
import type { ApiSuccessPayload } from '@/types/auth';
import { unwrapApiResponse } from '@/types/auth';
export {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
  isPasswordLengthValid,
} from '@/lib/passwordPolicy';

export type PasswordChangePayload = {
  currentPassword?: string;
  newPassword: string;
};

export type RequestEmailChangePayload = {
  newEmail: string;
  currentPassword: string;
};

export type DeleteAccountPayload = {
  confirmationWord: string;
  currentPassword: string;
};

export type PasswordResetConfirmPayload = {
  token: string;
  newPassword: string;
};

export type AdminFirstLoginResetPayload = {
  email: string;
  currentPassword: string;
  newPassword: string;
};

export type MessageResponse = {
  message: string;
};

const unwrapMessageResponse = (payload: unknown): MessageResponse => {
  return unwrapApiResponse<MessageResponse>(payload as ApiSuccessPayload<MessageResponse>);
};

export class AuthApi {
  static async requestPasswordReset(email: string): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/password-reset/request', { email });
    return unwrapMessageResponse(response.data);
  }

  static async confirmPasswordReset(
    payload: PasswordResetConfirmPayload,
  ): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/password-reset/confirm', payload);
    return unwrapMessageResponse(response.data);
  }

  static async changePassword(payload: PasswordChangePayload): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/change-password', payload);
    return unwrapMessageResponse(response.data);
  }

  static async requestEmailChange(payload: RequestEmailChangePayload): Promise<MessageResponse & { pendingEmail?: string }> {
    const response = await apiClient.post('/auth/change-email/request', payload);
    return unwrapApiResponse<MessageResponse & { pendingEmail?: string }>(response.data as ApiSuccessPayload<MessageResponse & { pendingEmail?: string }>);
  }

  static async confirmEmailChange(token: string): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/change-email/confirm', { token });
    return unwrapMessageResponse(response.data);
  }

  static async listSecuritySessions(): Promise<any[]> {
    const response = await apiClient.get('/auth/security/sessions');
    return unwrapApiResponse<any[]>(response.data as ApiSuccessPayload<any[]>);
  }

  static async revokeSecuritySession(sessionId: string): Promise<{ success: boolean }> {
    const response = await apiClient.patch(`/auth/security/sessions/${sessionId}/revoke`);
    return unwrapApiResponse<{ success: boolean }>(response.data as ApiSuccessPayload<{ success: boolean }>);
  }

  static async logoutOtherSessions(): Promise<{ revokedCount: number; currentSessionId?: string | null }> {
    const response = await apiClient.post('/auth/security/sessions/logout-others');
    return unwrapApiResponse<{ revokedCount: number; currentSessionId?: string | null }>(
      response.data as ApiSuccessPayload<{ revokedCount: number; currentSessionId?: string | null }>,
    );
  }

  static async deleteAccount(payload: DeleteAccountPayload): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/account/delete', payload);
    return unwrapMessageResponse(response.data);
  }

  static async completeAdminFirstLoginReset(
    payload: AdminFirstLoginResetPayload,
  ): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/admin/reset-password/first-login', payload);
    return unwrapMessageResponse(response.data);
  }

  static async requestAdminPasswordReset(email: string): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/admin/reset-password/request', { email });
    return unwrapMessageResponse(response.data);
  }

  static async confirmAdminPasswordReset(
    payload: PasswordResetConfirmPayload,
  ): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/admin/reset-password/confirm', payload);
    return unwrapMessageResponse(response.data);
  }
}

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

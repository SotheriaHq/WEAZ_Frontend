import { apiClient } from './httpClient';
import type { ApiSuccessPayload } from '@/types/auth';
import { unwrapApiResponse } from '@/types/auth';
import type { AuthTokensResponse, AuthUserType } from '@/types/auth';
import type { LegalAcceptancePayload } from '@/api/LegalApi';
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

export type GoogleAuthPayload = {
  idToken: string;
  type?: AuthUserType;
  brandFullName?: string;
  legalAcceptances?: LegalAcceptancePayload[];
};

export type LoginOptionsPayload = {
  email: string;
};

export type LoginOptionsResponse = {
  requestId: string;
  methods: {
    password: boolean;
    google: boolean;
    passwordSetupAvailable: boolean;
  };
  message: string;
};

export type EmailLoginCodePurpose = 'PASSWORD_SETUP' | 'DIRECT_LOGIN';

export type RequestEmailLoginCodePayload = {
  email: string;
  purpose: EmailLoginCodePurpose;
  requestId?: string;
};

export type ConfirmEmailLoginCodePayload = {
  email: string;
  code: string;
  purpose: EmailLoginCodePurpose;
};

export type ConfirmEmailLoginCodeResponse = {
  passwordSetupToken: string;
  expiresInSeconds: number;
};

export type PasswordSetupPayload = {
  passwordSetupToken: string;
  newPassword: string;
};

const unwrapMessageResponse = (payload: unknown): MessageResponse => {
  return unwrapApiResponse<MessageResponse>(payload as ApiSuccessPayload<MessageResponse>);
};

export class AuthApi {
  static async googleAuth(payload: GoogleAuthPayload): Promise<AuthTokensResponse> {
    const response = await apiClient.post<ApiSuccessPayload<AuthTokensResponse>>('/auth/google', payload);
    return unwrapApiResponse<AuthTokensResponse>(response.data);
  }

  static async googleLink(payload: Pick<GoogleAuthPayload, 'idToken'>): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/google/link', payload);
    return unwrapMessageResponse(response.data);
  }

  static async getLoginOptions(payload: LoginOptionsPayload): Promise<LoginOptionsResponse> {
    const response = await apiClient.post<ApiSuccessPayload<LoginOptionsResponse>>('/auth/login-options', payload);
    return unwrapApiResponse<LoginOptionsResponse>(response.data);
  }

  static async requestEmailLoginCode(payload: RequestEmailLoginCodePayload): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/email-login-code/request', payload);
    return unwrapMessageResponse(response.data);
  }

  static async confirmEmailLoginCode(
    payload: ConfirmEmailLoginCodePayload,
  ): Promise<ConfirmEmailLoginCodeResponse> {
    const response = await apiClient.post<ApiSuccessPayload<ConfirmEmailLoginCodeResponse>>(
      '/auth/email-login-code/confirm',
      payload,
    );
    return unwrapApiResponse<ConfirmEmailLoginCodeResponse>(response.data);
  }

  static async confirmDirectLoginCode(
    email: string,
    code: string,
  ): Promise<AuthTokensResponse> {
    const response = await apiClient.post<ApiSuccessPayload<AuthTokensResponse>>(
      '/auth/email-login-code/confirm',
      { email, code, purpose: 'DIRECT_LOGIN' },
    );
    return unwrapApiResponse<AuthTokensResponse>(response.data);
  }

  static async setupPassword(payload: PasswordSetupPayload): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/password/setup', payload);
    return unwrapMessageResponse(response.data);
  }

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

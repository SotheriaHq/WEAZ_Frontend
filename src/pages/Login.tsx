import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, Shield, LockKeyhole } from 'lucide-react';
import { isAxiosError } from 'axios';
import type { AuthTokensResponse, ApiSuccessPayload } from '../types/auth';
import { unwrapApiResponse } from '../types/auth';
import { useDispatch } from 'react-redux';
import { setUser } from '../features/userSlice';
import { addLocalNotification } from '../features/notificationsSlice';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiClient, persistAccessToken, dropStoredAccessToken } from '../api/httpClient';
import { AuthApi } from '@/api/AuthApi';
import type { LoginOptionsResponse } from '@/api/AuthApi';
import { env } from '@/config/env';

import {
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
} from '@/lib/passwordPolicy';
import Modal from '@/components/ui/Modal';
import VLoader from '@/components/loaders/VLoader';
import BrandWordmark from '@/components/brand/BrandWordmark';
import GoogleSignInOverlayButton from '@/components/auth/GoogleSignInOverlayButton';
import GoogleConsentModal from '@/components/auth/GoogleConsentModal';
import {
  getRequiredLegalAcceptances,
  LEGAL_SIGNUP_DOCUMENT_KEYS,
} from '@/api/LegalApi';
import {
  PasswordMatchFeedback,
  PasswordPolicyFeedback,
} from '@/components/auth/PasswordPolicyFeedback';
import { AppleLogoIcon } from '@/components/auth/SocialAuthIcons';
import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import '../styles/auth.css';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please provide a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .refine((value) => !/\s/.test(value), { message: 'Password cannot contain spaces' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const REMEMBERED_LOGIN_KEY = 'wiez-remembered-login';
const REMEMBERED_EMAILS_KEY = 'wiez-remembered-emails';
const PASSWORD_SETUP_PURPOSE = 'PASSWORD_SETUP' as const;

type LoginStep =
  | 'email'
  | 'password'
  | 'google-only'
  | 'code-login'
  | 'generic'
  | 'code'
  | 'password-setup'
  | 'setup-success';

const getAuthFlowErrorMessage = (error: unknown, fallback: string): string => {
  return getFriendlyErrorMessage(error, fallback);
};

// Loading Component
const LoadingScreen = () => (
  <div className="fixed inset-0 bg-brand-dark flex items-center justify-center z-50">
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <BrandWordmark
          logoSize={48}
          logoClassName="drop-shadow-[0_0_20px_rgba(212,175,55,0.45)]"
          textClassName="text-3xl font-serif font-bold text-[var(--text-primary)]"
        />
      </div>
      <div className="flex space-x-2 justify-center mb-4">
        <div className="w-3 h-3 bg-[#6B21A8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 bg-[#6B21A8] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-[var(--text-secondary)] text-lg">Welcome to your fashion journey...</p>
    </div>
  </div>
);

const LoginPage = () => {
  const rememberedState = useMemo(() => {
    if (typeof window === 'undefined') {
      return { remember: false, lastEmail: '', emails: [] as string[] };
    }

    try {
      const storedLoginRaw = window.localStorage.getItem(REMEMBERED_LOGIN_KEY);
      const storedEmailsRaw = window.localStorage.getItem(REMEMBERED_EMAILS_KEY);

      const storedLogin =
        storedLoginRaw !== null
          ? (JSON.parse(storedLoginRaw) as { remember?: boolean; email?: string })
          : null;
      const storedEmailsParsed =
        storedEmailsRaw !== null ? (JSON.parse(storedEmailsRaw) as unknown) : [];

      const sanitizedEmails = Array.isArray(storedEmailsParsed)
        ? storedEmailsParsed
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : [];

      const lastEmail =
        typeof storedLogin?.email === 'string'
          ? storedLogin.email.trim()
          : sanitizedEmails[0] ?? '';

      const uniqueEmails = Array.from(
        new Set<string>(lastEmail ? [lastEmail, ...sanitizedEmails] : sanitizedEmails),
      );

      return {
        remember: Boolean(storedLogin?.remember) && Boolean(lastEmail),
        lastEmail,
        emails: uniqueEmails,
      };
    } catch {
      return { remember: false, lastEmail: '', emails: [] as string[] };
    }
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const [loginOptions, setLoginOptions] = useState<LoginOptionsResponse | null>(null);
  const [loginOptionsLoading, setLoginOptionsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [flowError, setFlowError] = useState('');
  // New Google users need to accept terms before their account is created; the
  // pending ID token is retried with legalAcceptances once they consent.
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeLoading, setEmailCodeLoading] = useState(false);
  const [directLoginCode, setDirectLoginCode] = useState('');
  const [showDirectLoginCode, setShowDirectLoginCode] = useState(false);
  const [showEmailCode, setShowEmailCode] = useState(false);
  const [directLoginSendLoading, setDirectLoginSendLoading] = useState(false);
  const [directLoginConfirmLoading, setDirectLoginConfirmLoading] = useState(false);
  const [passwordSetupToken, setPasswordSetupToken] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupPasswordLoading, setSetupPasswordLoading] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReactivationLink, setShowReactivationLink] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [attemptsWarning, setAttemptsWarning] = useState('');
  const [showLockoutResetHint, setShowLockoutResetHint] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(rememberedState.remember);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>(rememberedState.emails);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [showForceResetModal, setShowForceResetModal] = useState(false);
  const [forceResetEmail, setForceResetEmail] = useState('');
  const [forceResetCurrentPassword, setForceResetCurrentPassword] = useState('');
  const [forceResetNewPassword, setForceResetNewPassword] = useState('');
  const [forceResetConfirmPassword, setForceResetConfirmPassword] = useState('');
  const [showResetCurrent, setShowResetCurrent] = useState(false);
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSubmittingForceReset, setIsSubmittingForceReset] = useState(false);
  const suggestionHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectState = location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null;
  const fromLocation = redirectState?.from;
  const redirectFromState = fromLocation?.pathname
    ? `${fromLocation.pathname}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}`
    : null;
  const redirectFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('returnTo');
    return value && value.startsWith('/') ? value : null;
  }, [location.search]);

  useEffect(() => {
    return () => {
      if (suggestionHideTimeout.current) {
        clearTimeout(suggestionHideTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (resendCooldownUntil === null) return;
    const tick = () => {
      const remaining = Math.ceil((resendCooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setResendCooldownUntil(null);
        setResendCooldownSeconds(0);
        setFlowError((prev) => prev.startsWith('Too many requests') ? '' : prev);
        return;
      }
      setResendCooldownSeconds(remaining);
      setFlowError((prev) => prev.startsWith('Too many requests') ? `Too many requests. Please try again in ${remaining}s.` : prev);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldownUntil]);

  // Failed-attempt lockout countdown (progressive backoff from the backend).
  useEffect(() => {
    if (lockoutUntil === null) return;
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSecondsLeft(0);
        return;
      }
      setLockoutSecondsLeft(remaining);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutUntil]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!rememberMe) {
      window.localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({ remember: false, email: '' }));
      setEmailSuggestions([]);
      return;
    }

    try {
      const storedEmailsRaw = window.localStorage.getItem(REMEMBERED_EMAILS_KEY);
      if (storedEmailsRaw) {
        const parsed = JSON.parse(storedEmailsRaw) as unknown;
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);

          if (sanitized.length > 0) {
            setEmailSuggestions(Array.from(new Set(sanitized)).slice(0, 5));
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [rememberMe]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    clearErrors,
    setValue,
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: rememberedState.remember ? rememberedState.lastEmail : '',
      password: '',
    },
  });
  const watchEmail = watch('email');
  const setupPasswordValid =
    getPasswordLength(setupPassword) >= PASSWORD_POLICY_MIN_LENGTH;
  const setupPasswordsMatch =
    setupConfirmPassword.length > 0 && setupPassword === setupConfirmPassword;
  const forceResetPasswordValid =
    getPasswordLength(forceResetNewPassword) >= PASSWORD_POLICY_MIN_LENGTH;
  const forceResetPasswordsMatch =
    forceResetConfirmPassword.length > 0 &&
    forceResetNewPassword === forceResetConfirmPassword;

  const resetProgressiveFlow = () => {
    setLoginStep('email');
    setLoginOptions(null);
    setFlowError('');
    setEmailCode('');
    setDirectLoginCode('');
    setShowDirectLoginCode(false);
    setShowEmailCode(false);
    setPasswordSetupToken('');
    setSetupPassword('');
    setSetupConfirmPassword('');
    setShowReactivationLink(false);
    setAttemptsWarning('');
    setShowLockoutResetHint(false);
  };

  const filteredSuggestions = useMemo(() => {
    const typed = (watchEmail ?? '').trim().toLowerCase();
    if (!typed) return emailSuggestions;
    return emailSuggestions.filter((suggestion) => {
      const normalized = suggestion.toLowerCase();
      return normalized.includes(typed) && normalized !== typed;
    });
  }, [emailSuggestions, watchEmail]);

  useEffect(() => {
    if (filteredSuggestions.length === 0) {
      setShowEmailSuggestions(false);
    }
  }, [filteredSuggestions.length]);

  const handleEmailFocus = () => {
    if (filteredSuggestions.length > 0) {
      setShowEmailSuggestions(true);
    }
  };

  const handleEmailBlur = () => {
    if (suggestionHideTimeout.current) {
      clearTimeout(suggestionHideTimeout.current);
    }
    suggestionHideTimeout.current = setTimeout(() => {
      setShowEmailSuggestions(false);
    }, 120);
  };

  const handleSuggestionSelect = (email: string) => {
    if (suggestionHideTimeout.current) {
      clearTimeout(suggestionHideTimeout.current);
    }
    setValue('email', email, { shouldDirty: true, shouldValidate: true });
    setShowEmailSuggestions(false);
  };

  const completeLogin = (
    payload: AuthTokensResponse,
    normalizedEmail: string,
  ) => {
    const { accessToken, user } = payload;
    if (!user || !user.id) throw new Error('Invalid login response');

    if (accessToken) {
      persistAccessToken(accessToken);
    }

    if (rememberMe) {
      const updatedEmails = [
        normalizedEmail,
        ...emailSuggestions.filter((email) => email.toLowerCase() !== normalizedEmail.toLowerCase()),
      ].slice(0, 5);
      setEmailSuggestions(updatedEmails);
      setShowEmailSuggestions(false);
      localStorage.setItem(REMEMBERED_EMAILS_KEY, JSON.stringify(updatedEmails));
      localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({ remember: true, email: normalizedEmail }));
    } else {
      setShowEmailSuggestions(false);
      localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({ remember: false, email: '' }));
    }

    dispatch(setUser(user));
    dispatch(addLocalNotification({ message: 'Signed in successfully.' }));
    toast.success('Login successful!');
    setShowReactivationLink(false);
    setLockoutUntil(null);
    setLockoutSecondsLeft(0);
    setAttemptsWarning('');
    setShowLockoutResetHint(false);

    const redirectPath =
      user.role === 'SuperAdmin' || user.role === 'Admin'
        ? '/admin'
        : redirectFromQuery || redirectFromState || '/profile';
    navigate(redirectPath, { replace: true });
    setIsRedirecting(true);
    reset({ email: rememberMe ? normalizedEmail : '', password: '' });
    setShowPassword(false);
  };

  const resolveLoginOptions = async () => {
    const normalizedEmail = (watchEmail ?? '').trim();
    const emailResult = loginSchema.shape.email.safeParse(normalizedEmail);
    if (!emailResult.success) {
      setError('email', {
        type: 'manual',
        message: 'Please provide a valid email address',
      });
      return;
    }

    setFlowError('');
    setShowReactivationLink(false);
    setLoginOptionsLoading(true);
    try {
      const options = await AuthApi.getLoginOptions({ email: normalizedEmail });
      setLoginOptions(options);

      if (options.methods.password) {
        setLoginStep('password');
        return;
      }

      if (options.methods.google || options.methods.passwordSetupAvailable) {
        setDirectLoginCode('');
        setShowDirectLoginCode(false);
        setLoginStep('code-login');
        void sendDirectLoginCode(normalizedEmail, options.requestId);
        return;
      }

      setFlowError('Invalid credentials');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        const rawRetryAfter = error.response.headers?.['retry-after'];
        const seconds = parseInt(String(rawRetryAfter ?? '60'), 10);
        const cooldown = isNaN(seconds) ? 60 : seconds;
        setResendCooldownUntil(Date.now() + cooldown * 1000);
        setResendCooldownSeconds(cooldown);
        setFlowError(`Too many requests. Please try again in ${cooldown}s.`);
      } else {
        setFlowError(getAuthFlowErrorMessage(error, 'Unable to check sign-in options. Try again.'));
      }
    } finally {
      setLoginOptionsLoading(false);
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    const normalizedEmail = (watchEmail ?? '').trim();
    setFlowError('');
    setGoogleLoading(true);
    try {
      dropStoredAccessToken();
      const payload = await AuthApi.googleAuth({ idToken, intent: 'LOGIN' });
      completeLogin(payload, payload.user?.email || normalizedEmail);
    } catch (error) {
      // Unknown Google user: the login screen must never create an account
      // silently. The backend returns GOOGLE_NO_ACCOUNT — route the user to
      // signup so they can choose an account type and accept the current terms.
      const data = isAxiosError(error)
        ? (error.response?.data as Record<string, unknown> | undefined)
        : undefined;
      if (data?.code === 'GOOGLE_NO_ACCOUNT') {
        toast.info("No account found for that Google sign-in — let's get you signed up.");
        navigate('/signup');
        return;
      }
      toast.error(getAuthFlowErrorMessage(error, 'Google sign-in could not be completed.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleConsentAccept = async () => {
    if (!pendingGoogleIdToken) return;
    const normalizedEmail = (watchEmail ?? '').trim();
    setConsentLoading(true);
    try {
      const legalAcceptances = await getRequiredLegalAcceptances(LEGAL_SIGNUP_DOCUMENT_KEYS);
      const payload = await AuthApi.googleAuth({ idToken: pendingGoogleIdToken, legalAcceptances });
      setPendingGoogleIdToken(null);
      completeLogin(payload, payload.user?.email || normalizedEmail);
    } catch (error) {
      toast.error(getAuthFlowErrorMessage(error, 'Google sign-in could not be completed.'));
    } finally {
      setConsentLoading(false);
    }
  };

  const handleGoogleError = (err: Error) => {
    toast.error(err.message || 'Google sign-in could not be completed.');
  };

  const sendDirectLoginCode = async (email: string, requestId?: string) => {
    if (resendCooldownUntil !== null && Date.now() < resendCooldownUntil) return;
    setDirectLoginSendLoading(true);
    try {
      await AuthApi.requestEmailLoginCode({ email, purpose: 'DIRECT_LOGIN', requestId });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        const rawRetryAfter = error.response.headers?.['retry-after'];
        const seconds = parseInt(String(rawRetryAfter ?? '60'), 10);
        const cooldown = isNaN(seconds) ? 60 : seconds;
        setResendCooldownUntil(Date.now() + cooldown * 1000);
        setResendCooldownSeconds(cooldown);
        setFlowError(`Too many resend attempts. Please wait ${cooldown}s before trying again.`);
      }
      // Otherwise silently fail — user can resend manually
    } finally {
      setDirectLoginSendLoading(false);
    }
  };

  const confirmDirectLoginCodeFn = async () => {
    const normalizedEmail = (watchEmail ?? '').trim();
    const code = directLoginCode.trim();
    if (!code) {
      setFlowError('Enter the code from your inbox.');
      return;
    }
    setFlowError('');
    setDirectLoginConfirmLoading(true);
    try {
      const result = await AuthApi.confirmDirectLoginCode(normalizedEmail, code);
      completeLogin(result, result.user?.email || normalizedEmail);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        setFlowError('Too many attempts. Please wait a moment before trying again.');
      } else {
        setFlowError(getAuthFlowErrorMessage(error, 'Invalid or expired code.'));
      }
    } finally {
      setDirectLoginConfirmLoading(false);
    }
  };

  const handleAppleComingSoon = () => {
    toast.info('Apple sign-in is coming soon.');
  };

  const requestPasswordSetupCode = async () => {
    const normalizedEmail = (watchEmail ?? '').trim();
    if (!normalizedEmail) {
      setFlowError('Enter your email first.');
      return;
    }
    if (resendCooldownUntil !== null && Date.now() < resendCooldownUntil) return;

    setFlowError('');
    setEmailCodeLoading(true);
    try {
      await AuthApi.requestEmailLoginCode({
        email: normalizedEmail,
        purpose: PASSWORD_SETUP_PURPOSE,
        requestId: loginOptions?.requestId,
      });
      setEmailCode('');
      setShowEmailCode(false);
      setLoginStep('code');
      toast.success('If eligible, a password setup code has been sent.');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        const rawRetryAfter = error.response.headers?.['retry-after'];
        const seconds = parseInt(String(rawRetryAfter ?? '60'), 10);
        const cooldown = isNaN(seconds) ? 60 : seconds;
        setResendCooldownUntil(Date.now() + cooldown * 1000);
        setResendCooldownSeconds(cooldown);
        setFlowError(`Too many requests. Please wait ${cooldown}s before requesting another code.`);
      } else {
        setFlowError(getAuthFlowErrorMessage(error, 'Unable to send a password setup code.'));
      }
    } finally {
      setEmailCodeLoading(false);
    }
  };

  const confirmPasswordSetupCode = async () => {
    const normalizedEmail = (watchEmail ?? '').trim();
    const code = emailCode.trim();
    if (!code) {
      setFlowError('Enter the verification code from your email.');
      return;
    }

    setFlowError('');
    setEmailCodeLoading(true);
    try {
      const result = await AuthApi.confirmEmailLoginCode({
        email: normalizedEmail,
        code,
        purpose: PASSWORD_SETUP_PURPOSE,
      });
      setPasswordSetupToken(result.passwordSetupToken);
      setEmailCode('');
      setShowEmailCode(false);
      setLoginStep('password-setup');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        setFlowError('Too many attempts. Please wait a moment before trying again.');
      } else {
        setFlowError(getAuthFlowErrorMessage(error, 'Invalid or expired verification code.'));
      }
    } finally {
      setEmailCodeLoading(false);
    }
  };

  const submitPasswordSetup = async () => {
    setFlowError('');
    if (!passwordSetupToken) {
      setFlowError('Your password setup session expired. Request a new code.');
      setLoginStep('code');
      return;
    }
    if (getPasswordLength(setupPassword) < PASSWORD_POLICY_MIN_LENGTH) {
      setFlowError(getPasswordPolicyErrorMessage('Password'));
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setFlowError('Passwords do not match.');
      return;
    }

    setSetupPasswordLoading(true);
    try {
      await AuthApi.setupPassword({
        passwordSetupToken,
        newPassword: setupPassword,
      });
      setPasswordSetupToken('');
      setSetupPassword('');
      setSetupConfirmPassword('');
      setLoginStep('setup-success');
      toast.success('Password created. Sign in with your new password.');
    } catch (error) {
      setFlowError(getAuthFlowErrorMessage(error, 'Unable to create your password.'));
    } finally {
      setSetupPasswordLoading(false);
    }
  };

  const submitFirstLoginReset = async () => {
    if (!forceResetEmail || !forceResetCurrentPassword || !forceResetNewPassword || !forceResetConfirmPassword) {
      toast.error('All password reset fields are required.');
      return;
    }
    if (getPasswordLength(forceResetNewPassword) < PASSWORD_POLICY_MIN_LENGTH) {
      toast.error(getPasswordPolicyErrorMessage('New password'));
      return;
    }
    if (forceResetNewPassword !== forceResetConfirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }

    setIsSubmittingForceReset(true);
    try {
      await AuthApi.completeAdminFirstLoginReset({
        email: forceResetEmail,
        currentPassword: forceResetCurrentPassword,
        newPassword: forceResetNewPassword,
      });

      const loginRes = await apiClient.post<ApiSuccessPayload<AuthTokensResponse>>('/auth/login', {
        email: forceResetEmail,
        password: forceResetNewPassword,
      });
      const payload = unwrapApiResponse(loginRes.data);
      completeLogin(payload, forceResetEmail);

      setShowForceResetModal(false);
      setForceResetCurrentPassword('');
      setForceResetNewPassword('');
      setForceResetConfirmPassword('');
      toast.success('Password set successfully. You are now signed in.');
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const data = error.response?.data as Record<string, unknown> | undefined;
        const responseMessage =
          (data && typeof data.message === 'string' && data.message) ||
          'Unable to complete password setup.';
        toast.error(responseMessage);
      } else {
        toast.error('Unable to complete password setup.');
      }
    } finally {
      setIsSubmittingForceReset(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    const normalizedEmail = data.email.trim();

    try {
      dropStoredAccessToken();
      const loginRes = await apiClient.post<ApiSuccessPayload<AuthTokensResponse>>(
        '/auth/login',
        { ...data, email: normalizedEmail },
      );
      const payload = unwrapApiResponse(loginRes.data);
      completeLogin(payload, normalizedEmail);
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const structuredData = error.response?.data as Record<string, unknown> | undefined;
        const structuredErrors =
          structuredData &&
          typeof structuredData.errors === 'object' &&
          structuredData.errors !== null &&
          !Array.isArray(structuredData.errors)
            ? (structuredData.errors as Record<string, unknown>)
            : undefined;
        const structuredCode =
          typeof structuredErrors?.code === 'string' ? structuredErrors.code : undefined;
        const structuredAttemptsRemaining =
          typeof structuredErrors?.attemptsRemaining === 'number'
            ? structuredErrors.attemptsRemaining
            : null;

        if (structuredAttemptsRemaining !== null && structuredAttemptsRemaining <= 5) {
          setAttemptsWarning(
            structuredAttemptsRemaining <= 1
              ? 'Final warning: one more failed attempt will suspend this account.'
              : `${structuredAttemptsRemaining} attempts remaining before this account is suspended.`,
          );
        }

        if (structuredCode === 'LOGIN_TEMPORARILY_LOCKED') {
          const rawRetryAfter = Number(structuredErrors?.retryAfterSeconds ?? 60);
          const seconds =
            Number.isFinite(rawRetryAfter) && rawRetryAfter > 0
              ? Math.ceil(rawRetryAfter)
              : 60;
          setLockoutUntil(Date.now() + seconds * 1000);
          setLockoutSecondsLeft(seconds);
          /*
            A lockout used to announce itself THREE times at once: a red field
            error, a toast, and the countdown panel — all saying the same thing,
            stacked, with the field error contradicting itself the moment the
            timer started ticking down from the fixed number baked into its text.

            The countdown panel is the only one of the three that stays true for
            the whole lockout, and it is the one that tells you what to do next
            (wait this long, or reset). So it is the single owner of this state:
            no field error, no toast. `attemptsWarning` is cleared for the same
            reason — it is the "you have N attempts left" warning, which the
            lockout has now superseded.
          */
          clearErrors('password');
          setAttemptsWarning('');
          setValue('password', '', { shouldDirty: false });
          setShowPassword(false);
          setIsLoading(false);
          return;
        }

        if (structuredCode === 'ACCOUNT_SUSPENDED_LOGIN_LOCKOUT') {
          const msg =
            (typeof structuredData?.message === 'string' && structuredData.message) ||
            'This account has been suspended after too many failed sign-in attempts.';
          setError('password', { type: 'server', message: msg });
          toast.error(msg);
          setShowReactivationLink(true);
          setShowLockoutResetHint(true);
          setAttemptsWarning('');
          setValue('password', '', { shouldDirty: false });
          setShowPassword(false);
          setIsLoading(false);
          return;
        }

        if (error.response?.status === 429) {
          const rawRetryAfter = error.response.headers?.['retry-after'];
          const seconds = parseInt(String(rawRetryAfter ?? '60'), 10);
          const cooldown = isNaN(seconds) ? 60 : seconds;
          setResendCooldownUntil(Date.now() + cooldown * 1000);
          setResendCooldownSeconds(cooldown);
          const msg = `Too many requests. Please try again in ${cooldown}s.`;
          setError('password', { type: 'server', message: msg });
          toast.error(msg);
          setIsLoading(false);
          return;
        }

        const responseData = error.response?.data as Record<string, unknown> | undefined;
        const responseMessage = getFriendlyErrorMessage(error, 'Login failed. Please try again.');

        const normalizedMessage = responseMessage.toLowerCase();
        const isForceResetRequired =
          normalizedMessage.includes('password reset required for this admin account before login');
        const accountBlocked =
          normalizedMessage.includes('suspended') ||
          normalizedMessage.includes('deactivated');
        setShowReactivationLink(accountBlocked);

        if (isForceResetRequired) {
          setShowForceResetModal(true);
          setForceResetEmail(normalizedEmail);
          setForceResetCurrentPassword(data.password);
        }

        if (responseData && Array.isArray((responseData as { errors?: unknown }).errors)) {
          const serverErrors = (responseData as { errors: Array<Record<string, unknown>> }).errors;
          let displayedMessage = '';

          serverErrors.forEach((serverErrorRaw) => {
            const serverError = serverErrorRaw as {
              property?: string;
              messages?: unknown;
              constraints?: unknown;
            };
            const fieldName = serverError.property as keyof LoginFormValues | undefined;
            const messages =
              (Array.isArray(serverError.messages) && serverError.messages) ||
              (Array.isArray(serverError.constraints) && serverError.constraints) ||
              [];
            const message = messages.length > 0 ? String(messages[0]) : responseMessage;

            if (fieldName) {
              setError(fieldName, { type: 'server', message });
            }
            if (!displayedMessage && message) {
              displayedMessage = message;
            }
          });

          toast.error(displayedMessage || responseMessage);
        } else {
          setError('password', { type: 'server', message: responseMessage });
          toast.error(responseMessage);
        }
      } else {
        toast.error('Login failed. Please try again.');
      }
      setValue('password', '', { shouldDirty: false });
      setShowPassword(false);
      setShowEmailSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isRedirecting) {
    return <LoadingScreen />;
  }

  const emailFieldRegistration = register('email');
  const passwordFieldRegistration = register('password');
  const canShowPasswordSetup =
    Boolean(loginOptions?.methods.passwordSetupAvailable) ||
    loginStep === 'code' ||
    loginStep === 'code-login' ||
    loginStep === 'password-setup';

  return (
    <div className="min-h-screen w-full bg-[var(--surface-primary)] text-[var(--text-primary)] font-sans antialiased overflow-x-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(var(--brand-primary-rgb),0.25), var(--surface-primary))',
          }}
        ></div>
        <div className="auth-particle w-96 h-96 top-[-10%] right-[-5%] opacity-30 animate-pulse-slow absolute"></div>
        <div className="auth-particle w-64 h-64 bottom-[10%] left-[40%] opacity-20 animate-float absolute" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-screen w-full relative">
        {/* Left Side: Imagery */}
        <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2864&auto=format&fit=crop" 
              alt="Fashion Model" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--surface-primary)]/90 via-[color:var(--surface-primary)]/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--surface-primary)] via-transparent to-transparent"></div>
          </div>

          {/* Logo */}
          <div className="relative z-10">
            <Link to="/" className="flex items-center gap-3 group">
              <BrandWordmark
                logoSize={40}
                logoClassName="drop-shadow-[0_0_14px_rgba(212,175,55,0.35)]"
                textClassName="text-2xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors"
              />
            </Link>
          </div>

          {/* Quote */}
          <div className="relative z-10 max-w-lg mt-auto mb-12 animate-float">
            <div className="w-16 h-1 bg-[var(--brand-accent)] mb-6"></div>
            <h2 className="text-4xl md:text-5xl font-serif font-medium leading-tight text-[var(--text-primary)] dark:text-white mb-6">
              "Fashion is the armor to survive the reality of everyday life."
            </h2>
            <p className="text-[var(--brand-accent)]/80 font-medium tracking-widest uppercase text-sm">— Bill Cunningham</p>
          </div>

          {/* Footer Links */}
          <div className="relative z-10 flex gap-6 text-sm text-[var(--text-secondary)] dark:text-gray-400">
            <Link to="/about" className="hover:text-[var(--brand-accent)] transition-colors">About Us</Link>
            <Link to="/collections" className="hover:text-[var(--brand-accent)] transition-colors">Collection</Link>
            <Link to="/contact" className="hover:text-[var(--brand-accent)] transition-colors">Contact</Link>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
          {/* Mobile Logo */}
          <Link to="/" className="lg:hidden absolute top-8 left-8 flex items-center gap-3 group">
            <BrandWordmark
              logoSize={32}
              logoClassName="drop-shadow-[0_0_12px_rgba(212,175,55,0.45)] group-hover:drop-shadow-[0_0_18px_rgba(212,175,55,0.6)] transition-[filter]"
              textClassName="text-xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors"
            />
          </Link>

          <div className="w-full max-w-md mt-16 lg:mt-0">
            {/* Login Card - Brighter glass panel */}
            <div className="auth-glass-panel rounded-2xl p-8 sm:p-10 w-full">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-serif font-bold text-[var(--text-primary)] dark:text-white mb-2">Welcome Back</h1>
                <p className="text-[var(--text-secondary)] dark:text-gray-400 text-sm">Enter your details to access your personal wardrobe.</p>
              </div>

              <form
                onSubmit={
                  loginStep === 'password'
                    ? handleSubmit(onSubmit)
                    : (event) => {
                        event.preventDefault();
                        void resolveLoginOptions();
                      }
                }
                className="space-y-6"
              >
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-xs font-medium auth-label uppercase tracking-wider ml-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="auth-field-icon h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      {...emailFieldRegistration}
                      placeholder="name@example.com"
                      className="auth-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm"
                      onFocus={handleEmailFocus}
                      onBlur={handleEmailBlur}
                      onChange={(event) => {
                        emailFieldRegistration.onChange(event);
                        if (loginStep !== 'email') {
                          resetProgressiveFlow();
                        }
                      }}
                    />
                    {showEmailSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 auth-popover rounded-lg shadow-lg z-30 max-h-40 overflow-auto">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={suggestion}
                            className="auth-popover-item w-full text-left px-4 py-2.5 text-sm transition-colors"
                            onMouseDown={() => handleSuggestionSelect(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.email && <p className="auth-error-text text-sm ml-1" role="alert">{errors.email.message}</p>}
                </div>

                {loginStep === 'password' && (
                  <>
                {/* Password */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-medium auth-label uppercase tracking-wider">Password</label>
                    <Link
                      to="/forgot-password"
                      tabIndex={-1}
                      className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="auth-field-icon h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...passwordFieldRegistration}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      aria-invalid={errors.password ? true : undefined}
                      aria-describedby={errors.password ? 'login-password-error' : undefined}
                      className={`auth-input w-full rounded-xl py-3.5 pl-11 pr-12 text-sm ${errors.password ? 'error' : ''}`}
                    />
                    <button
                      type="button"
                      className="auth-field-toggle absolute inset-y-0 right-0 my-1 mr-1 px-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="login-password-error" className="auth-error-text text-sm ml-1" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember Me */}
                <div className="flex items-center ml-1">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      setRememberMe(e.target.checked);
                      if (!e.target.checked) setShowEmailSuggestions(false);
                    }}
                    className="auth-checkbox"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm auth-muted cursor-pointer select-none">
                    Remember me for 30 days
                  </label>
                </div>
                  </>
                )}

                {loginStep === 'code-login' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium auth-label uppercase tracking-wider ml-1">
                      Sign-in Code
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="auth-field-icon h-4 w-4" />
                      </div>
                      <input
                        type={showDirectLoginCode ? 'text' : 'password'}
                        value={directLoginCode}
                        onChange={(e) => {
                          setDirectLoginCode(e.target.value);
                          setFlowError('');
                        }}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label="Sign-in code"
                        placeholder="Enter your code"
                        className="auth-input w-full rounded-xl py-3.5 pl-11 pr-12 text-sm tracking-[0.2em]"
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label={showDirectLoginCode ? 'Hide sign-in code' : 'Show sign-in code'}
                        className="auth-field-toggle absolute inset-y-0 right-0 my-1 mr-1 px-3 flex items-center"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setShowDirectLoginCode((visible) => !visible)}
                      >
                        {showDirectLoginCode ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs auth-muted ml-1">
                      A one-time sign-in code was sent to your email.{' '}
                      {resendCooldownSeconds > 0 ? (
                        <span className="auth-muted">Please wait {resendCooldownSeconds}s...</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void sendDirectLoginCode(
                              (watchEmail ?? '').trim(),
                              loginOptions?.requestId,
                            )
                          }
                          disabled={directLoginSendLoading}
                          className="text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] underline disabled:opacity-60"
                        >
                          {directLoginSendLoading ? 'Sending...' : 'Resend'}
                        </button>
                      )}
                    </p>
                  </div>
                )}



                {loginStep === 'code' && (
                  <div className="auth-raised auth-hairline space-y-3 rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-medium auth-heading">Enter your email code</p>
                      <p className="mt-1 text-xs auth-muted">
                        Use the code sent to your inbox to create your first password.
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type={showEmailCode ? 'text' : 'password'}
                        value={emailCode}
                        onChange={(event) => {
                          setEmailCode(event.target.value);
                          setFlowError('');
                        }}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label="Verification code"
                        placeholder="Verification code"
                        className="auth-input w-full rounded-xl px-4 py-3.5 pr-12 text-sm tracking-[0.25em]"
                      />
                      <button
                        type="button"
                        aria-label={showEmailCode ? 'Hide verification code' : 'Show verification code'}
                        className="auth-field-toggle absolute inset-y-0 right-0 my-1 mr-1 px-3 flex items-center"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setShowEmailCode((visible) => !visible)}
                      >
                        {showEmailCode ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmPasswordSetupCode()}
                        disabled={emailCodeLoading}
                        className="auth-btn-primary rounded-xl px-4 py-2.5 text-xs font-medium uppercase tracking-wide disabled:opacity-60"
                      >
                        {emailCodeLoading ? 'Checking...' : 'Verify code'}
                      </button>
                      {resendCooldownSeconds > 0 ? (
                        <span className="auth-hairline auth-muted rounded-xl border px-4 py-2.5 text-xs font-medium">
                          Wait {resendCooldownSeconds}s...
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void requestPasswordSetupCode()}
                          disabled={emailCodeLoading}
                          className="auth-hairline auth-subtext auth-hover-strong rounded-xl border px-4 py-2.5 text-xs font-medium disabled:opacity-60"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {loginStep === 'password-setup' && (
                  <div className="auth-raised auth-hairline space-y-3 rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-medium auth-heading">Create your password</p>
                      <p className="mt-1 text-xs auth-muted">
                        This creates your first WIEZ password. You will sign in after it is saved.
                      </p>
                    </div>
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={(event) => {
                        setSetupPassword(event.target.value);
                        setFlowError('');
                      }}
                      placeholder="New password"
                      minLength={PASSWORD_POLICY_MIN_LENGTH}
                      className="auth-input w-full rounded-xl px-4 py-3.5 text-sm"
                    />
                    <PasswordPolicyFeedback password={setupPassword} />
                    <input
                      type="password"
                      value={setupConfirmPassword}
                      onChange={(event) => {
                        setSetupConfirmPassword(event.target.value);
                        setFlowError('');
                      }}
                      placeholder="Confirm password"
                      minLength={PASSWORD_POLICY_MIN_LENGTH}
                      className="auth-input w-full rounded-xl px-4 py-3.5 text-sm"
                    />
                    <PasswordMatchFeedback
                      password={setupPassword}
                      confirmPassword={setupConfirmPassword}
                     
                    />
                    <button
                      type="button"
                      onClick={() => void submitPasswordSetup()}
                      disabled={
                        setupPasswordLoading ||
                        !setupPasswordValid ||
                        !setupPasswordsMatch
                      }
                      className="auth-btn-primary w-full rounded-xl py-3 text-sm font-medium tracking-wide disabled:opacity-60"
                    >
                      {setupPasswordLoading ? 'Saving password...' : 'Create password'}
                    </button>
                  </div>
                )}

                {loginStep === 'setup-success' && (
                  <>
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                      Password created. Sign in with your new password below.
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoginStep('password')}
                      className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide"
                    >
                      Sign in with new password
                    </button>
                  </>
                )}

                {flowError && (
                  <div className="auth-error-box rounded-xl p-3 text-sm">
                    {flowError}
                  </div>
                )}

                {/* Submit */}
                {loginStep === 'email' || loginStep === 'generic' ? (
                  <button
                    type="button"
                    onClick={() => void resolveLoginOptions()}
                    disabled={loginOptionsLoading}
                    className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide"
                  >
                    {loginOptionsLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <VLoader size={16} phase="loading" showLabel={false} />
                        Checking...
                      </span>
                    ) : (
                      'Continue'
                    )}
                  </button>
                ) : loginStep === 'password' ? (
                  <>
                    {attemptsWarning && lockoutSecondsLeft <= 0 && (
                      <div className="auth-notice rounded-xl p-3 text-xs">
                        ⚠️ {attemptsWarning}{' '}
                        <Link
                          to="/forgot-password"
                          className="auth-warn-strong auth-hover-strong font-medium underline"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                    )}
                    {lockoutSecondsLeft > 0 && (
                      <p
                        className="auth-notice-plain text-xs"
                        role="status"
                        aria-live="polite"
                      >
                        🔒 Sign-in is paused after repeated failed attempts. You can
                        try again in{' '}
                        <span className="auth-warn-strong font-semibold tabular-nums">
                          {Math.floor(lockoutSecondsLeft / 60)}:
                          {String(lockoutSecondsLeft % 60).padStart(2, '0')}
                        </span>
                        , or{' '}
                        <Link
                          to="/forgot-password"
                          className="auth-warn-text auth-hover-strong font-medium underline"
                        >
                          reset your password
                        </Link>{' '}
                        now.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isLoading || lockoutSecondsLeft > 0}
                      className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <VLoader size={16} phase="loading" showLabel={false} />
                          Signing In...
                        </span>
                      ) : lockoutSecondsLeft > 0 ? (
                        `Try again in ${Math.floor(lockoutSecondsLeft / 60)}:${String(lockoutSecondsLeft % 60).padStart(2, '0')}`
                      ) : (
                        'Sign In'
                      )}
                    </button>
                  </>
                ) : loginStep === 'code-login' ? (
                  <button
                    type="button"
                    onClick={() => void confirmDirectLoginCodeFn()}
                    disabled={directLoginConfirmLoading || directLoginSendLoading}
                    className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide"
                  >
                    {directLoginConfirmLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <VLoader size={16} phase="loading" showLabel={false} />
                        Signing In...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                ) : null}

                {loginStep !== 'email' && (
                  <button
                    type="button"
                    onClick={resetProgressiveFlow}
                    className="auth-quiet-btn text-xs font-medium"
                  >
                    Use a different email
                  </button>
                  )}
              </form>

              {showReactivationLink && (
                <div className="auth-notice mt-4 rounded-xl p-3">
                  <p className="auth-warn-text text-xs">
                    Account access is currently restricted. You can submit a leniency/reactivation request.
                  </p>
                  {showLockoutResetHint && (
                    <p className="auth-warn-text mt-2 text-xs">
                      Fastest fix:{' '}
                      <Link
                        to="/forgot-password"
                        className="auth-warn-strong auth-hover-strong font-medium underline"
                      >
                        reset your password
                      </Link>{' '}
                      — completing a reset from your email restores access
                      immediately.
                    </p>
                  )}
                  <Link
                    to={`/account-reactivation?email=${encodeURIComponent(
                      (watchEmail ?? '').trim(),
                    )}`}
                    className="auth-warn-strong auth-hover-strong mt-2 inline-block text-xs font-medium underline"
                  >
                    Submit reactivation request
                  </Link>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="auth-hairline w-full border-t"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="auth-divider-text px-4">Or continue with</span>
                </div>
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GoogleSignInOverlayButton
                  label={loginStep === 'code-login' ? 'Continue with Google' : 'Google'}
                  loading={googleLoading}
                  context="signin"
                  onToken={(token) => void handleGoogleToken(token)}
                  onError={handleGoogleError}
                  testId="login-google-button"
                />
                <button
                  type="button"
                  onClick={handleAppleComingSoon}
                  className="auth-social-btn flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium group"
                  aria-label="Apple sign-in coming soon"
                >
                  <AppleLogoIcon />
                  <span>Apple</span>
                </button>
              </div>

              {!env.google.configured && (
                <p className="auth-warn-text mt-3 text-center text-xs">
                  Google sign-in needs VITE_GOOGLE_CLIENT_ID in this environment.
                </p>
              )}

              <GoogleConsentModal
                open={pendingGoogleIdToken !== null}
                loading={consentLoading}
                onCancel={() => setPendingGoogleIdToken(null)}
                onAccept={() => void handleGoogleConsentAccept()}
              />

              {canShowPasswordSetup &&
                loginStep !== 'code' &&
                loginStep !== 'password-setup' &&
                loginStep !== 'setup-success' && (
                  <button
                    type="button"
                    onClick={() => void requestPasswordSetupCode()}
                    disabled={emailCodeLoading}
                    className="auth-hairline auth-subtext auth-hover-strong mt-4 w-full rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-60"
                  >
                    {emailCodeLoading ? 'Sending code...' : 'Create a password with email code'}
                  </button>
                )}

              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-sm auth-muted">
                  Don't have an account?{' '}
                  <Link to="/signup" className="auth-hover-strong font-medium transition-colors ml-1 text-[var(--brand-accent)]">
                    Sign Up
                  </Link>
                </p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="auth-muted mt-8 flex justify-center items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#6B21A8]" />
                <span>Secure Login</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-gray-700"></div>
              <div className="flex items-center gap-2">
                <LockKeyhole className="w-4 h-4 text-[#6B21A8]" />
                <span>256-bit Encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={showForceResetModal}
        onClose={() => {
          if (isSubmittingForceReset) return;
          setShowForceResetModal(false);
        }}
        title="🔐 Set A New Password"
        size="sm"
        scope="viewport"
        glassBackdrop={true}
        backdropStyle="light"
        className="border border-white/45 bg-white/85 shadow-[0_30px_90px_-28px_rgba(79,70,229,0.45)] dark:border-white/15 dark:bg-slate-900/85"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50/90 to-cyan-50/90 p-3 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-cyan-500/10">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              This admin account requires a first-login password update.
            </p>
            <p className="mt-1 text-xs text-indigo-800/90 dark:text-indigo-200/90">
              Enter your temporary password, then choose a secure new password to continue.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Email
            </label>
            <input
              value={forceResetEmail}
              onChange={(e) => setForceResetEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type={showResetCurrent ? 'text' : 'password'}
                value={forceResetCurrentPassword}
                onChange={(e) => setForceResetCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowResetCurrent((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {showResetCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showResetNew ? 'text' : 'password'}
                  value={forceResetNewPassword}
                  onChange={(e) => setForceResetNewPassword(e.target.value)}
                  minLength={PASSWORD_POLICY_MIN_LENGTH}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowResetNew((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  {showResetNew ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showResetConfirm ? 'text' : 'password'}
                  value={forceResetConfirmPassword}
                  onChange={(e) => setForceResetConfirmPassword(e.target.value)}
                  minLength={PASSWORD_POLICY_MIN_LENGTH}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirm((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  {showResetConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>
          <PasswordPolicyFeedback
            password={forceResetNewPassword}
            tone="light"
          />
          <PasswordMatchFeedback
            password={forceResetNewPassword}
            confirmPassword={forceResetConfirmPassword}
            tone="light"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForceResetModal(false)}
              disabled={isSubmittingForceReset}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitFirstLoginReset()}
              disabled={
                isSubmittingForceReset ||
                !forceResetPasswordValid ||
                !forceResetPasswordsMatch
              }
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmittingForceReset ? 'Setting Password...' : 'Set Password & Sign In'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LoginPage;

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
import {
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
} from '@/lib/passwordPolicy';
import Modal from '@/components/ui/Modal';
import VLoader from '@/components/loaders/VLoader';
import BrandWordmark from '@/components/brand/BrandWordmark';
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

const REMEMBERED_LOGIN_KEY = 'threadly-remembered-login';
const REMEMBERED_EMAILS_KEY = 'threadly-remembered-emails';

// Loading Component
const LoadingScreen = () => (
  <div className="fixed inset-0 bg-brand-dark flex items-center justify-center z-50">
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <BrandWordmark
          logoSize={48}
          logoClassName="drop-shadow-[0_0_20px_rgba(212,175,55,0.45)]"
          textClassName="text-3xl font-serif font-bold text-white"
        />
      </div>
      <div className="flex space-x-2 justify-center mb-4">
        <div className="w-3 h-3 bg-[#6B21A8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 bg-[#6B21A8] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-gray-400 text-lg">Welcome to your fashion journey...</p>
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
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReactivationLink, setShowReactivationLink] = useState(false);
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

    const redirectPath =
      user.role === 'SuperAdmin' || user.role === 'Admin'
        ? '/admin'
        : redirectFromQuery || redirectFromState || '/profile';
    navigate(redirectPath, { replace: true });
    setIsRedirecting(true);
    reset({ email: rememberMe ? normalizedEmail : '', password: '' });
    setShowPassword(false);
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
        const responseData = error.response?.data as Record<string, unknown> | undefined;
        const responseMessage =
          (responseData && typeof responseData.message === 'string' && responseData.message) ||
          'Login failed. Please try again.';
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

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300 uppercase tracking-wider ml-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-500" />
                    </div>
                    <input
                      type="email"
                      {...register('email')}
                      placeholder="name@example.com"
                      className="auth-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm"
                      onFocus={handleEmailFocus}
                      onBlur={handleEmailBlur}
                    />
                    {showEmailSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-[#0a0a0a]/95 border border-white/10 rounded-lg shadow-lg z-30 max-h-40 overflow-auto">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={suggestion}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                            onMouseDown={() => handleSuggestionSelect(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.email && <p className="text-sm text-red-400 ml-1">{errors.email.message}</p>}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">Password</label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      placeholder="••••••••"
                      className="auth-input w-full rounded-xl py-3.5 pl-11 pr-12 text-sm"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-red-400 ml-1">{errors.password.message}</p>}
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
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400 cursor-pointer select-none">
                    Remember me for 30 days
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <VLoader size={16} phase="loading" showLabel={false} />
                      Signing In...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {showReactivationLink && (
                <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-300">
                    Account access is currently restricted. You can submit a leniency/reactivation request.
                  </p>
                  <Link
                    to={`/account-reactivation?email=${encodeURIComponent(
                      (watchEmail ?? '').trim(),
                    )}`}
                    className="mt-2 inline-block text-xs font-medium text-amber-200 hover:text-white underline"
                  >
                    Submit reactivation request
                  </Link>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="auth-divider-text px-4 text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-4">
                <button type="button" className="auth-social-btn flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium group">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="group-hover:text-[#D4AF37] transition-colors">Google</span>
                </button>
                <button type="button" className="auth-social-btn flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium group">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                  </svg>
                  <span className="group-hover:text-[#D4AF37] transition-colors">Apple</span>
                </button>
              </div>

              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-400">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-[#D4AF37] font-medium hover:text-white transition-colors ml-1">
                    Sign Up
                  </Link>
                </p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex justify-center items-center gap-6 text-gray-500 text-xs">
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
              disabled={isSubmittingForceReset}
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

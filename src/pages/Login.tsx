
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Mail, Lock, Heart, Camera, ShoppingBag, Users } from 'lucide-react';
import { isAxiosError } from 'axios';
import type { AuthTokensResponse, ApiSuccessPayload } from '../types/auth';
import { unwrapApiResponse } from '../types/auth';
import { useDispatch } from 'react-redux';
import { setUser } from '../features/userSlice';
import { addLocalNotification } from '../features/notificationsSlice';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../lib/Animation';
// import voguelyLogo from '../lib/voguelyLogo';
import { apiClient, persistAccessToken, dropStoredAccessToken } from '../api/httpClient';
import { env } from '../config/env';

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
  <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
    <div className="text-center">
      <div className="relative mb-8">
        <div className="text-6xl font-bold text-white animate-pulse">
          voguely
        </div>
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
          <div className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      <div className="flex space-x-2 justify-center">
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-gray-300 mt-4 text-lg">Welcome to your fashion journey...</p>
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
  const [rememberMe, setRememberMe] = useState<boolean>(rememberedState.remember);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>(rememberedState.emails);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const suggestionHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Robustly protect login page from authenticated users
  useEffect(() => {
    // Check all possible token keys and user object
    const tokenKeys = [env.tokenStorageKey, 'token'];
    const hasToken = tokenKeys.some((key) => !!localStorage.getItem(key));
    let hasUser = false;
    try {
      const user = localStorage.getItem(env.userStorageKey);
      if (user && typeof user === 'string') {
        const parsed = JSON.parse(user);
        if (parsed && (parsed.id || parsed._id)) {
          hasUser = true;
        }
      }
    } catch (e) {
      void e;
    }
    if (hasToken || hasUser) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (suggestionHideTimeout.current) {
        clearTimeout(suggestionHideTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!rememberMe) {
      window.localStorage.setItem(
        REMEMBERED_LOGIN_KEY,
        JSON.stringify({ remember: false, email: '' }),
      );
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
    if (!typed) {
      return emailSuggestions;
    }
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

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    const normalizedEmail = data.email.trim();
    const payload = {
      ...data,
      email: normalizedEmail,
    };

    try {
      dropStoredAccessToken();
      const loginRes = await apiClient.post<ApiSuccessPayload<AuthTokensResponse>>(
        '/auth/login',
        payload,
      );
      const { accessToken, user } = unwrapApiResponse(loginRes.data);
      if (!user || !user.id) throw new Error('Invalid login response');

      if (accessToken) {
        persistAccessToken(accessToken);
        localStorage.removeItem('access_token');
        localStorage.removeItem('accessToken');
      }

      if (rememberMe) {
        const updatedEmails = [
          normalizedEmail,
          ...emailSuggestions.filter(
            (email) => email.toLowerCase() !== normalizedEmail.toLowerCase(),
          ),
        ].slice(0, 5);
        setEmailSuggestions(updatedEmails);
        setShowEmailSuggestions(false);
        localStorage.setItem(REMEMBERED_EMAILS_KEY, JSON.stringify(updatedEmails));
        localStorage.setItem(
          REMEMBERED_LOGIN_KEY,
          JSON.stringify({ remember: true, email: normalizedEmail }),
        );
      } else {
        setShowEmailSuggestions(false);
        localStorage.setItem(
          REMEMBERED_LOGIN_KEY,
          JSON.stringify({ remember: false, email: '' }),
        );
      }

      dispatch(setUser(user));
      dispatch(addLocalNotification({ message: 'Signed in successfully.' }));
      toast.success('Login successful!');
      // Navigate immediately to reduce flicker/blank states
      const redirectPath = user.type === 'BRAND' ? '/profile' : '/';
      navigate(redirectPath, { replace: true });
      // Optional subtle loading state if the component lingers
      setIsRedirecting(true);
      reset({ email: rememberMe ? normalizedEmail : '', password: '' });
      setShowPassword(false);
      // We already navigated; previously delayed redirect has been removed.
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const data = error.response?.data as Record<string, unknown> | undefined;
        const responseMessage =
          (data && typeof data.message === 'string' && data.message) ||
          'Login failed. Please try again.';

        if (data && Array.isArray((data as { errors?: unknown }).errors)) {
          const serverErrors = (data as { errors: Array<Record<string, unknown>> }).errors;
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
    <div className="min-h-screen w-full flex bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 relative">
      {/* Animated background covers the entire screen */}
      <AnimatedBackground />
      {/* Centered Left Feature List */}
      <div className="hidden lg:flex flex-col items-center justify-center absolute left-0 top-0 bottom-0 w-1/2 z-10">
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white w-full h-full">
          <h1 className="text-5xl font-bold mb-4">voguely</h1>
          <p className="text-xl text-gray-300 mb-12">Discover Nigerian Fashion</p>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-1">Local Brands</h3>
              <p className="text-sm text-gray-400">Authentic Nigerian fashion</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-1">Visual Stories</h3>
              <p className="text-sm text-gray-400">Share your style</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-1">Community</h3>
              <p className="text-sm text-gray-400">Connect with fashion lovers</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-1">Shop More</h3>
              <p className="text-sm text-gray-400">Discover new collections</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 italic">"Where fashion meets culture"</p>
        </div>
      </div>

      {/* Login Form Card - Reduced height, subtle borders, new logo */}
      <div className="w-full flex justify-end items-center lg:items-center relative z-20">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl px-8 py-6 mt-8 mr-4 lg:mr-20 max-w-lg w-[95vw] lg:w-[400px] xl:w-[440px] relative z-10 border border-white/20" style={{ minWidth: 320 }}>
          {/* Logo */}
          <div className="flex justify-center mb-3">
            {/* <voguelyLogo size={48} /> */}
          </div>
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome Back</h2>
            <p className="text-gray-600 text-sm">Sign in to your fashion journey</p>
          </div>
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="Enter your email"
                  className="block w-full pl-9 pr-3 py-2.5 border-none rounded-lg outline-none text-gray-900 placeholder-gray-500 transition duration-200 text-sm"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  inputMode="email"
                  data-lpignore="true"
                  onFocus={handleEmailFocus}
                  onBlur={handleEmailBlur}
                  aria-autocomplete="list"
                  aria-expanded={showEmailSuggestions}
                />
                {showEmailSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-40 overflow-auto animate-slideDown">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onMouseDown={() => handleSuggestionSelect(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Enter your password"
                  className="block w-full pl-9 pr-10 py-2.5 border-none rounded-lg outline-none text-gray-900 placeholder-gray-500 transition duration-200 text-sm"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  data-lpignore="true"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    if (!checked) {
                      setShowEmailSuggestions(false);
                    }
                  }}
                  className="h-4 w-4 text-blue-600 border-none rounded outline-none"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <a href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                Forgot password?
              </a>
            </div>
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing In...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          {/* Divider */}
          <div className="mt-5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>
          {/* Social Login */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition duration-200">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="ml-2">Google</span>
            </button>
            <button className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition duration-200">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="ml-2">Facebook</span>
            </button>
          </div>
          {/* Sign Up Link */}
          <p className="mt-5 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up for free
            </a>
          </p>
          {/* Join As Options */}
          <div className="mt-4">
            <p className="text-center text-xs text-gray-500 mb-3">Join as:</p>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/signup?type=regular"
                className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition duration-200 group"
              >
                <Users className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mb-1" />
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600">Fashion Lover</span>
              </a>
              <a
                href="/signup?type=brand"
                className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition duration-200 group"
              >
                <ShoppingBag className="w-6 h-6 text-gray-400 group-hover:text-purple-500 mb-1" />
                <span className="text-xs font-medium text-gray-700 group-hover:text-purple-600">Brand/Designer</span>
              </a>
            </div>
          </div>
          {/* Copyright */}
          <p className="mt-4 text-center text-xs text-gray-400">
            © 2024 voguely. Supporting Nigerian Fashion.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;





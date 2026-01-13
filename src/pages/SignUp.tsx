import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, ShoppingBag, Scissors, Sparkles, Heart, Palette, Check, ArrowRight } from 'lucide-react';
import { isAxiosError } from 'axios';
import type { AuthTokensResponse, ApiSuccessPayload } from '../types/auth';
import { unwrapApiResponse } from '../types/auth';
import { useDispatch } from 'react-redux';
import { setUser } from '../features/userSlice';
import { addLocalNotification } from '../features/notificationsSlice';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient, persistAccessToken, dropStoredAccessToken } from '../api/httpClient';
import '../styles/auth.css';

const CONFETTI_STORAGE_KEY = 'threadly-signup-confetti';

const hasCelebratedSignup = (userId: string | undefined | null): boolean => {
  if (!userId || typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(CONFETTI_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) && parsed.includes(userId);
  } catch {
    return true;
  }
};

const markCelebratedSignup = (userId: string | undefined | null) => {
  if (!userId || typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CONFETTI_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(parsed) ? Array.from(new Set([...parsed, userId])) : [userId];
    window.localStorage.setItem(CONFETTI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort only
  }
};

const fireSignupConfetti = async () => {
  try {
    const confetti = (await import('canvas-confetti')).default;
    const shoot = (particleRatio: number, opts: Record<string, unknown>) => {
      confetti({
        particleCount: Math.floor(160 * particleRatio),
        startVelocity: 45,
        spread: 70,
        ticks: 120,
        origin: { y: 0.6 },
        ...opts,
      });
    };

    shoot(0.25, { spread: 26, startVelocity: 55 });
    shoot(0.2, { spread: 60 });
    shoot(0.35, { spread: 100, decay: 0.92, scalar: 0.9 });
    shoot(0.1, { spread: 120, startVelocity: 40 });
    shoot(0.1, { spread: 120, startVelocity: 60 });
  } catch {
    // ignore confetti load issues
  }
};

const celebrateSignupOnce = async (userId: string | undefined | null) => {
  if (hasCelebratedSignup(userId)) return;
  await fireSignupConfetti();
  markCelebratedSignup(userId);
};

const signupSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: 'First name is required' })
    .min(2, { message: 'First name must be at least 2 characters' })
    .max(50, { message: 'First name must be less than 50 characters' })
    .regex(/^[a-zA-Z\s-]+$/, { message: 'First name can only contain letters, spaces, or hyphens' }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: 'Last name is required' })
    .min(2, { message: 'Last name must be at least 2 characters' })
    .max(50, { message: 'Last name must be less than 50 characters' })
    .regex(/^[a-zA-Z\s-]+$/, { message: 'Last name can only contain letters, spaces, or hyphens' }),
  brandFullName: z
    .string()
    .trim()
    .optional(),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please provide a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(6, { message: 'Password must be at least 6 characters' })
    .refine((value) => !/\s/.test(value), { message: 'Password cannot contain spaces' }),
  confirmPassword: z
    .string()
    .min(1, { message: 'Please confirm your password' }),
  userType: z.enum(['REGULAR', 'BRAND'], { message: 'Please select an account type' }),
  agreeTerms: z.literal(true, { message: 'You must agree to the terms' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine((data) => {
  // Brand accounts require brandFullName
  if (data.userType === 'BRAND') {
    return data.brandFullName && data.brandFullName.trim().length >= 2;
  }
  return true;
}, {
  message: 'Brand name is required',
  path: ['brandFullName'],
});

type SignupFormValues = z.infer<typeof signupSchema>;

// Loading Component
const LoadingScreen = () => (
  <div className="fixed inset-0 bg-[var(--surface-primary)] text-[var(--text-primary)] dark:bg-[var(--surface-primary)] flex items-center justify-center z-50">
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-brand-gold flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.5)]">
          <span className="text-2xl font-bold tracking-tight text-[var(--surface-primary)]">T</span>
        </div>
        <span className="text-3xl font-bold tracking-tight text-[var(--text-primary)] dark:text-white">Threadly</span>
      </div>
      <div className="flex space-x-2 justify-center mb-4">
        <div className="w-3 h-3 bg-[var(--brand-primary-strong)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 bg-[var(--brand-accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 bg-[var(--brand-primary-strong)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-[var(--text-secondary)] text-lg">Creating your fashion journey...</p>
    </div>
  </div>
);

// Password strength calculator
const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  if (strength <= 2) return { strength, label: 'Weak', color: '#ef4444' };
  if (strength === 3) return { strength, label: 'Fair', color: '#f59e0b' };
  if (strength === 4) return { strength, label: 'Good', color: '#10b981' };
  return { strength, label: 'Strong', color: '#22c55e' };
};

const SignUpPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
    setError,
    setValue,
    watch,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      brandFullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      userType: undefined,
      agreeTerms: undefined,
    },
  });

  const watchPassword = watch('password') || '';
  const watchUserType = watch('userType');

  const passwordStrength = useMemo(() => getPasswordStrength(watchPassword), [watchPassword]);

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    const normalizedEmail = data.email.trim();

    try {
      dropStoredAccessToken();
      const signupRes = await apiClient.post<ApiSuccessPayload<AuthTokensResponse>>(
        '/auth/signup',
        {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: normalizedEmail,
          password: data.password,
          type: data.userType,
          ...(data.userType === 'BRAND' && data.brandFullName ? { brandFullName: data.brandFullName.trim() } : {}),
        },
      );
      const { accessToken, user } = unwrapApiResponse(signupRes.data);
      if (!user || !user.id) throw new Error('Invalid signup response');

      if (accessToken) {
        persistAccessToken(accessToken);
        localStorage.removeItem('access_token');
        localStorage.removeItem('accessToken');
      }

      dispatch(setUser(user));
      dispatch(addLocalNotification({ message: 'Account created successfully!' }));
      toast.success('Welcome to Threadly!');

      await celebrateSignupOnce(user.id);

      if (user.type === 'BRAND') {
        // Ensure the post-signup prompt shows even if previously dismissed.
        localStorage.removeItem('threadly.brandProfileSetup.dismissedUntil');
        navigate('/profile?modal=brand-setup&modalOrigin=prompt', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      setIsRedirecting(true);
      reset();
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const data = error.response?.data as Record<string, unknown> | undefined;
        const responseMessage =
          (data && typeof data.message === 'string' && data.message) || 'Sign up failed. Please try again.';

        if (data && Array.isArray((data as { errors?: unknown }).errors)) {
          const serverErrors = (data as { errors: Array<Record<string, unknown>> }).errors;
          let displayedMessage = '';

          serverErrors.forEach((serverErrorRaw) => {
            const serverError = serverErrorRaw as {
              property?: string;
              messages?: unknown;
              constraints?: unknown;
            };
            const fieldName = serverError.property as keyof SignupFormValues | undefined;
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
          setError('email', { type: 'server', message: responseMessage });
          toast.error(responseMessage);
        }
      } else {
        toast.error('Sign up failed. Please try again.');
      }
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
              'radial-gradient(ellipse at top left, rgba(var(--brand-primary-rgb),0.25), var(--surface-primary))',
          }}
        ></div>
        <div className="auth-particle w-96 h-96 bottom-[-10%] left-[-5%] opacity-30 animate-pulse-slow absolute"></div>
        <div className="auth-particle w-64 h-64 top-[20%] right-[30%] opacity-20 animate-float absolute" style={{ animationDelay: '2s' }}></div>
        
        {/* New Decorative Shapes */}
        <div className="auth-floating-shape shape-diamond w-24 h-24 top-[15%] left-[10%] opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="auth-floating-shape shape-circle w-32 h-32 bottom-[20%] right-[10%] opacity-10 animate-float" style={{ animationDelay: '3s' }}></div>
        <div className="auth-floating-shape shape-diamond w-16 h-16 top-[40%] left-[45%] opacity-10 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-screen w-full relative">
        {/* Left Side: Brand & Value Props */}
        <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[rgba(var(--brand-primary-strong-rgb),0.22)] via-[color:var(--surface-primary)] to-[color:var(--surface-primary)]"></div>

          {/* Logo */}
          <div className="relative z-10">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-[var(--brand-accent)] flex items-center justify-center text-[var(--surface-primary)] font-serif font-bold text-2xl shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                T
              </div>
              <span className="text-2xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors">
                Threadly
              </span>
            </Link>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 max-w-lg">
            <div className="w-16 h-1 bg-[var(--brand-accent)] mb-6"></div>
            <h2 className="text-4xl md:text-5xl font-serif font-medium leading-tight text-[var(--text-primary)] dark:text-white mb-6">
              Join the Fashion Revolution
            </h2>
            <p className="text-[var(--text-secondary)] dark:text-gray-300 text-lg mb-12">
              Connect with independent designers, discover unique pieces, and build your personal style collection.
            </p>

            {/* Value Props */}
            <div className="space-y-6">
              <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-[rgba(var(--brand-primary-strong-rgb),0.15)] border border-[rgba(var(--brand-primary-strong-rgb),0.28)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(var(--brand-primary-strong-rgb),0.25)] transition-colors">
                    <Sparkles className="w-5 h-5 text-[var(--brand-accent)]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)] dark:text-white mb-1">Discover Unique Designs</h3>
                    <p className="text-[var(--text-secondary)] dark:text-gray-400 text-sm">Access exclusive collections from emerging fashion talents worldwide.</p>
                  </div>
                </div>

              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-[rgba(var(--brand-primary-strong-rgb),0.15)] border border-[rgba(var(--brand-primary-strong-rgb),0.28)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(var(--brand-primary-strong-rgb),0.25)] transition-colors">
                  <Heart className="w-5 h-5 text-[var(--brand-accent)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)] dark:text-white mb-1">Support Independent Designers</h3>
                  <p className="text-[var(--text-secondary)] dark:text-gray-400 text-sm">Directly connect with and support the creators you love.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-[rgba(var(--brand-primary-strong-rgb),0.15)] border border-[rgba(var(--brand-primary-strong-rgb),0.28)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(var(--brand-primary-strong-rgb),0.25)] transition-colors">
                  <Palette className="w-5 h-5 text-[var(--brand-accent)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)] dark:text-white mb-1">Curate Your Style</h3>
                  <p className="text-[var(--text-secondary)] dark:text-gray-400 text-sm">Build collections that reflect your unique aesthetic vision.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className="relative z-10 flex gap-6 text-sm text-[var(--text-secondary)] dark:text-gray-400">
            <Link to="/about" className="hover:text-[var(--brand-accent)] transition-colors">About Us</Link>
            <Link to="/collections" className="hover:text-[var(--brand-accent)] transition-colors">Collection</Link>
            <Link to="/contact" className="hover:text-[var(--brand-accent)] transition-colors">Contact</Link>
          </div>
        </div>

        {/* Right Side: Sign Up Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
          {/* Mobile Logo */}
          <Link to="/" className="lg:hidden absolute top-8 left-8 flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-[var(--brand-accent)] flex items-center justify-center text-[var(--surface-primary)] font-serif font-bold text-lg shadow-[0_0_12px_rgba(212,175,55,0.4)] group-hover:shadow-[0_0_20px_rgba(212,175,55,0.6)] transition-shadow">
              T
            </div>
            <span className="text-xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors">Threadly</span>
          </Link>

          <div className="w-full max-w-md mt-16 lg:mt-0">
            {/* Sign Up Card - Brighter glass panel */}
            <div className="auth-glass-panel rounded-2xl p-8 sm:p-10 w-full">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>Create Account</h1>
                <p className="text-gray-300 text-base font-medium">Start your fashion journey with Threadly.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* User Type Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-200 uppercase tracking-widest ml-1">
                    I am a...
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setValue('userType', 'REGULAR', { shouldValidate: true })}
                      className={`auth-selection-card p-4 rounded-xl text-left transition-all relative group ${
                        watchUserType === 'REGULAR' ? 'active' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-[rgba(var(--brand-primary-strong-rgb),0.18)] flex items-center justify-center mb-3 selection-icon">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-white text-base block mb-1">Fashion Lover</span>
                      <p className="text-sm text-purple-300 font-medium mb-3">Discover & collect</p>
                      
                      {/* Feature List */}
                      <ul className="space-y-2">
                        {['Exclusive drops', 'Follow designers', 'Create wishlists'].map((feat, i) => (
                           <li key={i} className="flex items-center gap-2 text-xs text-gray-200 font-medium">
                             <span className="feature-list-check"><Check className="w-2.5 h-2.5" /></span>
                             {feat}
                           </li>
                        ))}
                      </ul>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue('userType', 'BRAND', { shouldValidate: true })}
                      className={`auth-selection-card p-4 rounded-xl text-left transition-all relative group ${
                        watchUserType === 'BRAND' ? 'active' : ''
                      }`}
                    >
                      {/* Badge */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                         {watchUserType === 'BRAND' && <div className="popular-badge">Popular Choice</div>}
                      </div>

                      <div className="w-10 h-10 rounded-lg bg-[rgba(var(--brand-primary-strong-rgb),0.18)] flex items-center justify-center mb-3 selection-icon relative">
                        <Scissors className="w-5 h-5" />
                        {watchUserType === 'BRAND' && (
                          <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-[var(--brand-gold)] animate-pulse" />
                        )}
                      </div>
                      <span className="font-bold text-white text-base block mb-1">Fashion Brand</span>
                      <p className="text-sm text-purple-300 font-medium mb-3">Sell & showcase</p>

                      {/* Feature List */}
                      <ul className="space-y-2">
                        {['Your own store', 'Analytics dashboard', 'Direct community'].map((feat, i) => (
                           <li key={i} className="flex items-center gap-2 text-xs text-gray-200 font-medium">
                             <span className="feature-list-check"><Check className="w-2.5 h-2.5" /></span>
                             {feat}
                           </li>
                        ))}
                      </ul>
                    </button>
                  </div>
                  
                  {/* Progress Teaser */}
                  {watchUserType === 'BRAND' && (
                    <div className="animate-fade-in-up mt-2 p-3 rounded-lg bg-[rgba(var(--brand-gold-rgb),0.1)] border border-[rgba(var(--brand-gold-rgb),0.2)] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--brand-gold)] text-black flex items-center justify-center">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--brand-gold)] uppercase tracking-wide">Next Step</p>
                        <p className="text-xs text-[var(--text-primary)]/80">Set up your store & customize your brand profile</p>
                      </div>
                    </div>
                  )}
                  {errors.userType && <p className="text-sm text-red-400 ml-1">{errors.userType.message}</p>}
                </div>

                {/* Full Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-widest ml-1">
                      First Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-[var(--text-secondary)]" />
                      </div>
                      <input
                        type="text"
                        {...register('firstName')}
                        placeholder="John"
                        className={`auth-input w-full rounded-xl py-3.5 pl-11 pr-10 text-sm ${
                            errors.firstName ? 'error animate-shake' : ''
                        } ${!errors.firstName && dirtyFields.firstName ? 'success' : ''}`}
                      />
                       <div className={`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none input-check-icon ${!errors.firstName && dirtyFields.firstName ? 'visible' : ''}`}>
                          <Check className="h-4 w-4" />
                       </div>
                    </div>
                    {errors.firstName && <p className="text-sm text-red-400 ml-1">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-widest ml-1">
                      Last Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-[var(--text-secondary)]" />
                      </div>
                      <input
                        type="text"
                        {...register('lastName')}
                        placeholder="Doe"
                        className={`auth-input w-full rounded-xl py-3.5 pl-11 pr-10 text-sm ${
                            errors.lastName ? 'error animate-shake' : ''
                        } ${!errors.lastName && dirtyFields.lastName ? 'success' : ''}`}
                      />
                       <div className={`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none input-check-icon ${!errors.lastName && dirtyFields.lastName ? 'visible' : ''}`}>
                          <Check className="h-4 w-4" />
                       </div>
                    </div>
                    {errors.lastName && <p className="text-sm text-red-400 ml-1">{errors.lastName.message}</p>}
                  </div>
                </div>

                {/* Brand Full Name - Only for Brand accounts */}
                {watchUserType === 'BRAND' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-widest ml-1">
                      Brand Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Scissors className="h-4 w-4 text-[var(--text-secondary)]" />
                      </div>
                      <input
                        type="text"
                        {...register('brandFullName')}
                        placeholder="Your Brand Name"
                        className="auth-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm"
                      />
                    </div>
                    {errors.brandFullName && <p className="text-sm text-red-400 ml-1">{errors.brandFullName.message}</p>}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-widest ml-1">
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
                      className={`auth-input w-full rounded-xl py-3.5 pl-11 pr-10 text-sm ${
                        errors.email ? 'error animate-shake' : ''
                      } ${!errors.email && dirtyFields.email ? 'success' : ''}`}
                    />
                    <div className={`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none input-check-icon ${!errors.email && dirtyFields.email ? 'visible' : ''}`}>
                       <Check className="h-4 w-4" />
                    </div>
                  </div>
                  {errors.email && <p className="text-sm text-red-400 ml-1">{errors.email.message}</p>}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-widest ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      placeholder="••••••••"
                      className={`auth-input w-full rounded-xl py-3.5 pl-11 pr-12 text-sm ${
                        errors.password ? 'error animate-shake' : ''
                      }`}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Password Strength Indicator */}
                  {watchPassword && (
                    <div className="auth-password-strength mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              level <= passwordStrength.strength ? '' : 'bg-white/10'
                            }`}
                            style={{
                              backgroundColor: level <= passwordStrength.strength ? passwordStrength.color : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                  {errors.password && <p className="text-sm text-red-400 ml-1">{errors.password.message}</p>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-widest ml-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...register('confirmPassword')}
                      placeholder="••••••••"
                      className={`auth-input w-full rounded-xl py-3.5 pl-11 pr-12 text-sm ${
                        errors.confirmPassword ? 'error animate-shake' : ''
                      }`}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-red-400 ml-1">{errors.confirmPassword.message}</p>}
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start gap-3">
                  <input
                    id="agree-terms"
                    type="checkbox"
                    {...register('agreeTerms')}
                    className="auth-checkbox mt-0.5"
                  />
                  <label htmlFor="agree-terms" className="text-sm text-gray-400 cursor-pointer select-none leading-tight">
                    I agree to the{' '}
                    <Link to="/terms" className="text-[#D4AF37] hover:text-white transition-colors">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-[#D4AF37] hover:text-white transition-colors">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {errors.agreeTerms && <p className="text-sm text-red-400 ml-1">{errors.agreeTerms.message}</p>}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide mt-2"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating Account...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="auth-divider-text px-4 text-gray-500">Or sign up with</span>
                </div>
              </div>

              {/* Social Sign Up */}
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

              {/* Sign In Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  Already have an account?{' '}
                  <Link to="/login" className="text-[#D4AF37] font-medium hover:text-white transition-colors ml-1">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;

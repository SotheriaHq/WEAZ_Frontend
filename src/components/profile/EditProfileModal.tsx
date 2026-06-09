
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthUserDto } from '../../types/auth';
import type { BrandProfileDto } from '../../types/profile';
import { brandApi, type UpdateBrandProfilePayload } from '../../api/BrandApi';
import { toast } from 'sonner';
import { locationService, type CountryOption, type StateOption } from '../../services/LocationService';
import UniversalSelect from '../forms/UniversalSelect';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { BRAND_TAG_OPTIONS, BRAND_TAG_SELECTION_LIMIT } from '../../data/brandTags';
import VLoader from '@/components/loaders/VLoader';

// ----------------------------------------------------------------------------
// Zod Schemas & Helpers
// ----------------------------------------------------------------------------
const urlRegex = /^https?:\/\//i;
const socialHandleRegex = /^@?[A-Za-z0-9._-]{2,50}$/;

const optionalSocialSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      urlRegex.test(value) ||
      socialHandleRegex.test(value),
    { message: 'Enter a valid URL or username/handle' },
  );

const profileSchema = z
  .object({
    brandFullName: z
      .string()
      .trim()
      .min(2, { message: 'Brand name must be at least 2 characters' })
      .max(120, { message: 'Brand name must be 120 characters or fewer' }),
    brandDescription: z
      .string()
      .trim()
      .min(20, { message: 'Tell us at least 20 characters about your brand' })
      .max(2000, { message: 'Keep your description under 2000 characters' }),
    brandCountry: z.string().optional(),
    brandState: z.string().optional(),
    brandCity: z.string().optional(),
    brandTags: z
      .array(z.string())
      .max(BRAND_TAG_SELECTION_LIMIT, {
        message: `Choose up to ${BRAND_TAG_SELECTION_LIMIT} tags.`,
      })
      .optional(),
    socialInstagram: optionalSocialSchema,
    socialFacebook: optionalSocialSchema,
    socialTwitter: optionalSocialSchema,
    socialWebsite: optionalSocialSchema,
    phoneNumber: z.string().trim().max(30, { message: 'Phone number is too long' }).optional(),
    businessType: z.string().trim().max(120, { message: 'Business type is too long' }).optional(),
  })
  .refine(
    (values) =>
      Boolean((values.brandCountry ?? '').trim() || (values.brandState ?? '').trim()),
    {
      path: ['brandCountry'],
      message: 'Add at least country or state to complete setup',
    },
  );

type ProfileFormValues = z.infer<typeof profileSchema>;
type SubmitStatus = 'idle' | 'saving' | 'syncing' | 'almost' | 'complete';
const MAX_TAGS = BRAND_TAG_SELECTION_LIMIT;
const BRAND_TAG_CHIP_PALETTE = [
  'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-fuchsia-500/25',
  'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/25',
  'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/25',
  'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-amber-500/25',
  'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-500/25',
  'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-indigo-500/25',
];
const BUSINESS_TYPE_OPTIONS = [
  { value: 'Retailer', label: 'Retailer' },
  { value: 'Designer', label: 'Designer' },
  { value: 'Wholesaler', label: 'Wholesaler' },
  { value: 'Boutique', label: 'Boutique' },
];

const getFirstErrorMessage = (errors: unknown): string | null => {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    for (const error of errors) {
      const message = getFirstErrorMessage(error);
      if (message) return message;
    }
    return null;
  }
  if (typeof errors !== 'object') return null;
  const errorObject = errors as Record<string, unknown>;
  if (typeof errorObject.message === 'string' && errorObject.message.length > 0) return errorObject.message;
  if (errorObject.types && typeof errorObject.types === 'object') {
    const firstTypeMessage = Object.values(errorObject.types as Record<string, unknown>)[0];
    if (typeof firstTypeMessage === 'string' && firstTypeMessage.length > 0) return firstTypeMessage;
  }
  for (const value of Object.values(errorObject)) {
    const message = getFirstErrorMessage(value);
    if (message) return message;
  }
  return null;
};

const ensureHttps = (value?: string | null): string | undefined => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return undefined;
  if (urlRegex.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^https?:\/\//i, '')}`;
};

const normalizeSocialLink = (
  platform: 'instagram' | 'facebook' | 'twitter' | 'website',
  value?: string | null,
): string | undefined => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return undefined;
  const asUrl = urlRegex.test(trimmed) ? ensureHttps(trimmed) : undefined;
  if (asUrl) return asUrl;
  const handle = socialHandleRegex.test(trimmed) ? trimmed.replace(/^@/, '') : trimmed;
  if (!handle) return undefined;
  const base =
    platform === 'instagram'
      ? 'https://instagram.com'
      : platform === 'facebook'
        ? 'https://facebook.com'
        : platform === 'twitter'
          ? 'https://x.com'
          : '';
  return base ? `${base}/${handle}` : ensureHttps(trimmed);
};

// ----------------------------------------------------------------------------
// Component Props
// ----------------------------------------------------------------------------
interface EditProfileModalProps {
  isOpen: boolean;
  user: AuthUserDto;
  brandProfile: BrandProfileDto | null;
  showSkip?: boolean;
  onSkip?: () => void;
  onClose: () => void;
  onSaved: (user: AuthUserDto) => Promise<void> | void;
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------
const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  user,
  brandProfile,
  showSkip,
  onSkip,
  onClose,
  onSaved,
}) => {
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const originalBodyOverflow = useRef<string | null>(null);
  
  // Location States
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Tags State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');

  // Initial Values
  const initialValues = useMemo<ProfileFormValues>(() => {
    return {
      brandFullName:
        brandProfile?.brandFullName ||
        user.brandFullName ||
        `${user.firstName} ${user.lastName}`.trim() ||
        user.username,
      brandDescription: brandProfile?.description || user.brandDescription || '',
      brandCountry: brandProfile?.country || user.brandCountry || '',
      brandState: brandProfile?.state || user.brandState || '',
      brandCity: brandProfile?.city || user.brandCity || '',
      brandTags:
        brandProfile?.tags ||
        user.brandTags ||
        BRAND_TAG_OPTIONS.slice(0, 3).map((tag) => tag.value),
      socialInstagram: brandProfile?.socialLinks?.instagram || user.socialInstagram || '',
      socialFacebook: brandProfile?.socialLinks?.facebook || user.socialFacebook || '',
      socialTwitter: brandProfile?.socialLinks?.twitter || user.socialTwitter || '',
      socialWebsite: brandProfile?.socialLinks?.website || user.socialWebsite || '',
      phoneNumber: brandProfile?.contactInfo?.phone || user.phoneNumber || '',
      businessType: brandProfile?.contactInfo?.businessType || user.brandBusinessType || '',
    };
  }, [brandProfile, user]);

  // Hook Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setFocus,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  const brandDescriptionField = register('brandDescription');
  const descriptionValue = watch('brandDescription');
  const selectedCountry = watch('brandCountry');
  const selectedState = watch('brandState');
  const submitStatusMessage =
    submitStatus === 'saving'
      ? 'Saving your profile...'
      : submitStatus === 'syncing'
        ? 'Syncing your profile...'
        : submitStatus === 'almost'
          ? 'Almost ready - still finishing your update...'
          : submitStatus === 'complete'
            ? 'Profile saved.'
            : null;

  // Initialize selected tags from profile/user
  useEffect(() => {
    setSelectedTags((initialValues.brandTags ?? []).slice(0, MAX_TAGS));
    setTagError(null);
  }, [initialValues]);

  useEffect(() => {
    if (!isSubmitting) {
      if (submitStatus !== 'idle') setSubmitStatus('idle');
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSubmitStatus((current) =>
        current === 'saving' || current === 'syncing' ? 'almost' : current,
      );
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [isSubmitting, submitStatus]);

  // Load Countries on Mount
  useEffect(() => {
    const loadCountries = async () => {
        setLoadingLocations(true);
        const data = await locationService.getCountries();
        setCountries(data);
        setLoadingLocations(false);
    };
    if (isOpen) {
        void loadCountries();
        reset(initialValues);
        // Small timeout to allow render before focusing
        setTimeout(() => descriptionRef.current?.focus(), 50);
    }
  }, [isOpen, initialValues, reset]);

  // Cascade: Load States when Country changes
  useEffect(() => {
    const loadStates = async () => {
        if (!selectedCountry) {
            setStates([]);
            return;
        }
        setLoadingLocations(true);
        const data = await locationService.getStates(selectedCountry);
        setStates(data);
        setLoadingLocations(false);
    };
    void loadStates();
  }, [selectedCountry]);

  // Cascade: Load Cities when State changes
  useEffect(() => {
    const loadCities = async () => {
        if (!selectedCountry || !selectedState) {
            setCities([]);
            return;
        }
        setLoadingLocations(true);
        const data = await locationService.getCities(selectedCountry, selectedState);
        setCities(data);
        setLoadingLocations(false);
    };
    void loadCities();
  }, [selectedCountry, selectedState]);

  // Scroll Locking
  useEffect(() => {
    if (isOpen) {
      originalBodyOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow.current ?? '';
        document.documentElement.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen]);

  // Submit Handler
  const onSubmit = useCallback(
    async (values: ProfileFormValues) => {
      try {
        if (selectedTags.length === 0) {
          setTagError('Select at least one tag.');
          toast.error('Select at least one tag.');
          return;
        }
        if (selectedTags.length > MAX_TAGS) {
          setTagError(`Choose up to ${MAX_TAGS} tags.`);
          toast.error(`Choose up to ${MAX_TAGS} tags.`);
          return;
        }

        setSubmitStatus('saving');

        const brandCountry = values.brandCountry?.trim() || undefined;
        const brandState = values.brandState?.trim() || undefined;
        const brandCity = values.brandCity?.trim() || undefined;
        const phoneNumber = values.phoneNumber?.trim() || undefined;
        const businessType = values.businessType?.trim() || undefined;

        const payload: UpdateBrandProfilePayload = {
          brandFullName: values.brandFullName.trim(),
          brandDescription: values.brandDescription.trim(),
          brandCountry,
          brandState,
          brandCity,
          brandTags: selectedTags,
          socialInstagram: normalizeSocialLink('instagram', values.socialInstagram),
          socialFacebook: normalizeSocialLink('facebook', values.socialFacebook),
          socialTwitter: normalizeSocialLink('twitter', values.socialTwitter),
          socialWebsite: normalizeSocialLink('website', values.socialWebsite),
          phoneNumber,
          businessType,
        };

        const updatedUser = await brandApi.updateBrandProfile(user.id, payload);
        if (!updatedUser) throw new Error('Profile update failed.');

        setSubmitStatus('syncing');
        toast.success('Profile updated successfully');
        await onSaved(updatedUser);
        setSubmitStatus('complete');
      } catch (error) {
        setSubmitStatus('idle');
        if (error instanceof Error) toast.error(error.message);
        else toast.error('Unable to update profile.');
      }
    },
    [onSaved, user.id, selectedTags],
  );

  const onInvalid = useCallback(
    (formErrors: FieldErrors<ProfileFormValues>) => {
      const message = getFirstErrorMessage(formErrors);
      toast.error(message ?? 'Please fix the highlighted fields before saving.');
      const firstErrorKey = Object.keys(formErrors)[0] as keyof ProfileFormValues;
      if (firstErrorKey) setFocus(firstErrorKey);
    },
    [setFocus],
  );

  // Country Options for Select
  const countryOptions = useMemo(() => countries.map(c => ({
    value: c.name,
    label: c.name,
    icon: (
      <MediaRenderer
        kind="image"
        src={c.flagImage}
        alt={c.name}
        maxHeightClassName="max-h-5"
        maxWidthClassName="max-w-8"
        className="rounded-sm"
        mediaClassName="rounded-sm"
      />
    ),
  })), [countries]);

  const stateOptions = useMemo(() => states.map(s => ({
    value: s.name,
    label: s.name
  })), [states]);

  const cityOptions = useMemo(() => cities.map(c => ({
    value: c,
    label: c
  })), [cities]);

  const tagOptions = useMemo(() => {
    const base = BRAND_TAG_OPTIONS;
    const baseValues = new Set(base.map((tag) => tag.value));
    const extras = selectedTags
      .filter((tag) => tag && !baseValues.has(tag))
      .map((tag) => ({ label: tag, value: tag }));
    return [...extras, ...base];
  }, [selectedTags]);

  const toggleTag = (value: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((tag) => tag !== value);
        if (tagError && next.length > 0) setTagError(null);
        return next;
      }
      if (prev.length >= MAX_TAGS) {
        setTagError(`Choose up to ${MAX_TAGS} tags.`);
        return prev;
      }
      const next = [...prev, value];
      if (tagError && next.length > 0) setTagError(null);
      return next;
    });
  };

  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <>
        {/* Background Overlay */}
        <div className="fixed inset-0 z-layer-overlay">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
        </div>

        {/* Main Modal Container */}
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Brand setup">
          <div ref={dialogRef} tabIndex={-1} className="relative w-full max-w-4xl neu-modal-surface surface-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in border border-theme">

          {/* Scrollable Content */}
          <form 
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="overflow-y-auto custom-scrollbar p-8 space-y-10 overscroll-contain"
          >

            {/* Modal Title + Close (inside body, no separate header) */}
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-theme">Brand Setup</h2>
                <p className="text-sm text-theme-secondary mt-1">Create your brand identity & story</p>
              </div>
              <div className="flex items-center gap-2">
                {showSkip && onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    disabled={isSubmitting}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 transition"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Section: Identity */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <path d="M16 2v4M8 2v4M3 10h18"></path>
                  </svg>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-theme">Brand Identity</h3>
                    <p className="text-xs text-gray-500">How you appear to customers</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-theme-secondary">Brand Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. WEAZ Couture"
                    className="w-full h-12 px-4 rounded-lg border border-theme-strong surface-card text-theme placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" 
                    {...register('brandFullName')}
                  />
                  {errors.brandFullName && <p className="text-xs text-red-500 font-medium">{errors.brandFullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-theme-secondary">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">@</span>
                    <input 
                      type="text" 
                      placeholder="username" 
                      className="w-full h-12 pl-8 pr-4 rounded-lg border border-theme-strong surface-subtle text-gray-500 cursor-not-allowed" 
                      value={user.username}
                      disabled
                      title="Username cannot be changed here"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2">
                   <div className="space-y-2">
                    <label className="text-sm font-semibold text-theme-secondary">Email Address <span className="text-gray-400 font-normal text-xs ml-2">(Private)</span></label>
                    <input 
                        type="email" 
                        placeholder="contact@brand.com" 
                        className="w-full h-12 px-4 rounded-lg border border-theme-strong surface-subtle text-gray-500 cursor-not-allowed" 
                        value={user.email}
                        disabled
                    />
                   </div>
                </div>
              </div>
            </div>

            {/* Section: Story & Tags */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
               <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-pink-600 dark:text-pink-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </div>
                <div>
                   <h3 className="text-lg font-bold text-theme">Story & Vision</h3>
                   <p className="text-xs text-gray-500">What makes your brand unique?</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2 relative">
                    <label className="text-sm font-semibold text-theme-secondary">Brand Story</label>
                    <textarea 
                        className="w-full h-40 p-4 rounded-lg border border-theme-strong surface-card text-theme placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none leading-relaxed" 
                        placeholder="Tell the world about your vision, heritage, and what makes your fashion unique..."
                        {...brandDescriptionField}
                        ref={(e) => {
                            brandDescriptionField.ref(e);
                            descriptionRef.current = e;
                        }}
                    ></textarea>
                     <div className="text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            (descriptionValue?.length || 0) < 20 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                             Minimum 20 chars ({descriptionValue?.length || 0}/2000)
                        </span>
                    </div>
                    {errors.brandDescription && <p className="text-xs text-red-500 mt-1 font-medium">{errors.brandDescription.message}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-theme-secondary">
                        Brand Tags 
                        <span className="ml-2 text-xs font-normal text-gray-500">(Select up to {MAX_TAGS})</span>
                    </label>
                    <div className="flex flex-wrap gap-2 p-4 rounded-xl border border-theme surface-subtle/40">
                      {tagOptions.map((tag, index) => {
                        const isSelected = selectedTags.includes(tag.value);
                        const selectedChipColor =
                          BRAND_TAG_CHIP_PALETTE[index % BRAND_TAG_CHIP_PALETTE.length];
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => toggleTag(tag.value)}
                            disabled={isSubmitting}
                            aria-pressed={isSelected}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-70 ${
                              isSelected
                                ? selectedChipColor
                                : 'surface-card text-theme-secondary border border-theme hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            #{tag.label}
                          </button>
                        );
                      })}
                    </div>
                    {tagError && <p className="text-xs text-red-500 mt-1 font-medium">{tagError}</p>}
                    {!tagError && (
                      <p className="text-xs text-gray-500">Add at least one tag to help users find you.</p>
                    )}
                </div>
              </div>
            </div>

            {/* Section: Contact & Biz */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                 <div>
                   <h3 className="text-lg font-bold text-theme">Business Location</h3>
                   <p className="text-xs text-gray-500">Where are you based?</p>
                </div>
              </div>

              {/* Location Fields */}
              <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <UniversalSelect
                          label="Country"
                          value={selectedCountry || ''}
                          onChange={(val) => {
                              setValue('brandCountry', val, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue('brandState', '', {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue('brandCity', '', { shouldDirty: true });
                              clearErrors('brandCountry');
                          }}
                          options={countryOptions}
                          placeholder={loadingLocations ? "Loading..." : "Select Country"}
                          searchable
                          searchPlaceholder="Search countries..."
                          emptyMessage="No matching country found"
                          disabled={loadingLocations}
                          className="w-full"
                          menuLayer="modal"
                      />
                       <UniversalSelect
                          label="State / Province"
                          value={selectedState || ''}
                          onChange={(val) => {
                              setValue('brandState', val, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue('brandCity', '', { shouldDirty: true });
                              clearErrors('brandCountry');
                          }}
                          options={stateOptions}
                          placeholder={loadingLocations ? "Loading..." : "State/Province"}
                          searchable
                          searchPlaceholder="Search states or provinces..."
                          emptyMessage="No matching state or province found"
                          disabled={!selectedCountry || stateOptions.length === 0 || loadingLocations}
                          className="w-full"
                          menuLayer="modal"
                      />
                       <UniversalSelect
                          label="City"
                          value={watch('brandCity') || ''}
                          onChange={(val) =>
                            setValue('brandCity', val, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          options={cityOptions}
                          placeholder={loadingLocations ? "Loading..." : "City"}
                          searchable
                          searchPlaceholder="Search cities..."
                          emptyMessage="No matching city found"
                          disabled={!selectedState || cityOptions.length === 0 || loadingLocations}
                          className="w-full"
                          menuLayer="modal"
                      />
                  </div>
                  {errors.brandCountry && (
                    <p className="text-xs text-red-500 font-medium">{errors.brandCountry.message}</p>
                  )}
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 z-10">
                  <UniversalSelect
                    label="Business Type"
                    value={watch('businessType') || ''}
                    onChange={(value) =>
                      setValue('businessType', value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={BUSINESS_TYPE_OPTIONS}
                    placeholder="Select Type"
                    searchable
                    searchPlaceholder="Search business types..."
                    emptyMessage="No matching business type found"
                    disabled={isSubmitting}
                    className="w-full"
                    menuLayer="modal"
                  />
                  {errors.businessType && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.businessType.message}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-theme-secondary">Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="+1 (555) 000-0000" 
                    className="w-full h-12 px-4 rounded-lg border border-theme-strong surface-card text-theme placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    {...register('phoneNumber')}
                  />
                  {errors.phoneNumber && <p className="text-xs text-red-500 font-medium">{errors.phoneNumber.message}</p>}
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-theme-secondary">Instagram Handle</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </div>
                    <input 
                      type="text" 
                      placeholder="instagram.com/" 
                      className="w-full h-12 pl-12 pr-4 rounded-lg border border-theme-strong surface-card text-theme placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      {...register('socialInstagram')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden Submit for Enter Key */}
            <button type="submit" className="hidden" />

            {/* Actions (inside body, no separate footer) */}
            <div className="flex justify-end gap-4 pt-2">
              {isSubmitting && submitStatusMessage ? (
                <div className="mr-auto flex min-h-11 items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 dark:bg-purple-500/10 dark:text-fuchsia-200" role="status" aria-live="polite">
                  <VLoader size={18} phase={submitStatus === 'almost' ? 'finishing' : 'loading'} showLabel={false} />
                  <span>{submitStatusMessage}</span>
                </div>
              ) : null}
              <button 
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-lg text-sm font-semibold text-theme-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleSubmit(onSubmit, onInvalid)()}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="min-w-[12rem] px-8 py-3 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <span className="inline-flex w-full items-center justify-center">
                  {submitStatusMessage ?? 'Save and Continue'}
                </span>
              </button>
            </div>
            
          </form>
          </div>
        </div>
      </>
    </OverlayPortal>
  );
};

export default EditProfileModal;

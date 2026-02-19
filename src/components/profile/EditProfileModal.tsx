
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
import { BRAND_TAG_OPTIONS } from '../../data/brandTags';

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

const profileSchema = z.object({
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
  brandTags: z.array(z.string()).optional(),
  socialInstagram: optionalSocialSchema,
  socialFacebook: optionalSocialSchema,
  socialTwitter: optionalSocialSchema,
  socialWebsite: optionalSocialSchema,
  phoneNumber: z.string().trim().max(30, { message: 'Phone number is too long' }).optional(),
  businessType: z.string().trim().max(120, { message: 'Business type is too long' }).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
const MAX_TAGS = 5;

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

  // Initialize selected tags from profile/user
  useEffect(() => {
    setSelectedTags(initialValues.brandTags ?? []);
    setTagError(null);
  }, [initialValues]);

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

        toast.success('Profile updated successfully');
        await onSaved(updatedUser);
        onClose();
      } catch (error) {
        if (error instanceof Error) toast.error(error.message);
        else toast.error('Unable to update profile.');
      }
    },
    [onSaved, user.id, onClose, selectedTags],
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
          <div ref={dialogRef} tabIndex={-1} className="relative w-full max-w-4xl neu-modal-surface bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in border border-gray-200 dark:border-gray-800">

          {/* Scrollable Content */}
          <form 
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="overflow-y-auto custom-scrollbar p-8 space-y-10 overscroll-contain"
          >

            {/* Modal Title + Close (inside body, no separate header) */}
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Brand Setup</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Create your brand identity & story</p>
              </div>
              <div className="flex items-center gap-2">
                {showSkip && onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
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
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Brand Identity</h3>
                    <p className="text-xs text-gray-500">How you appear to customers</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Brand Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Threadly Couture" 
                    className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" 
                    {...register('brandFullName')}
                  />
                  {errors.brandFullName && <p className="text-xs text-red-500 font-medium">{errors.brandFullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">@</span>
                    <input 
                      type="text" 
                      placeholder="username" 
                      className="w-full h-12 pl-8 pr-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed" 
                      value={user.username}
                      disabled
                      title="Username cannot be changed here"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2">
                   <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address <span className="text-gray-400 font-normal text-xs ml-2">(Private)</span></label>
                    <input 
                        type="email" 
                        placeholder="contact@brand.com" 
                        className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed" 
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
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Story & Vision</h3>
                   <p className="text-xs text-gray-500">What makes your brand unique?</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2 relative">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Brand Story</label>
                    <textarea 
                        className="w-full h-40 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none leading-relaxed" 
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
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Brand Tags 
                        <span className="ml-2 text-xs font-normal text-gray-500">(Select up to {MAX_TAGS})</span>
                    </label>
                    <div className="flex flex-wrap gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                      {tagOptions.map((tag) => {
                        const isSelected = selectedTags.includes(tag.value);
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => toggleTag(tag.value)}
                            disabled={isSubmitting}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
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
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Business Location</h3>
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
                              setValue('brandCountry', val);
                              setValue('brandState', '');
                              setValue('brandCity', '');
                          }}
                          options={countryOptions}
                          placeholder={loadingLocations ? "Loading..." : "Select Country"}
                          disabled={loadingLocations}
                          className="w-full"
                      />
                       <UniversalSelect
                          label="State / Province"
                          value={selectedState || ''}
                          onChange={(val) => {
                              setValue('brandState', val);
                              setValue('brandCity', '');
                          }}
                          options={stateOptions}
                          placeholder={loadingLocations ? "Loading..." : "State/Province"}
                          disabled={!selectedCountry || stateOptions.length === 0 || loadingLocations}
                          className="w-full"
                      />
                       <UniversalSelect
                          label="City"
                          value={watch('brandCity') || ''}
                          onChange={(val) => setValue('brandCity', val)}
                          options={cityOptions}
                          placeholder={loadingLocations ? "Loading..." : "City"}
                          disabled={!selectedState || cityOptions.length === 0 || loadingLocations}
                          className="w-full"
                      />
                  </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 z-10">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Business Type</label>
                  <div className="relative">
                    <select className="select-threadly w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-purple-500 focus:border-transparent" {...register('businessType')}>
                      <option value="" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Select Type</option>
                      <option value="Retailer" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Retailer</option>
                      <option value="Designer" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Designer</option>
                      <option value="Wholesaler" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Wholesaler</option>
                      <option value="Boutique" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Boutique</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="+1 (555) 000-0000" 
                    className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    {...register('phoneNumber')}
                  />
                  {errors.phoneNumber && <p className="text-xs text-red-500 font-medium">{errors.phoneNumber.message}</p>}
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Instagram Handle</label>
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
                      className="w-full h-12 pl-12 pr-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleSubmit(onSubmit, onInvalid)()}
                disabled={isSubmitting}
                className="px-8 py-3 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? 'Saving Profile...' : 'Save & Continue'}
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

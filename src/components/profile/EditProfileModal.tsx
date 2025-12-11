
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, MapPin, ExternalLink } from 'lucide-react';
import FrostedButton, { IconButton } from '@/components/ui/FrostedButton';
import type { AuthUserDto } from '../../types/auth';
import type { BrandProfileDto } from '../../types/profile';
import { brandApi, type UpdateBrandProfilePayload } from '../../api/BrandApi';
import { toast } from 'sonner';
import { BRAND_TAG_OPTIONS } from '../../data/brandTags';
import {
  DEFAULT_COUNTRY,
  LOCATION_DATA,
  getCitiesForState,
  getStatesForCountry,
} from '../../data/locations';

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
  brandTags: z
    .array(z.string())
    .min(1, { message: 'Select at least one tag' })
    .max(6, { message: 'You can select up to six tags' }),
  socialInstagram: optionalSocialSchema,
  socialFacebook: optionalSocialSchema,
  socialTwitter: optionalSocialSchema,
  socialWebsite: optionalSocialSchema,
  phoneNumber: z.string().trim().max(30, { message: 'Phone number is too long' }).optional(),
  businessType: z.string().trim().max(120, { message: 'Business type is too long' }).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const getFirstErrorMessage = (errors: unknown): string | null => {
  if (!errors) {
    return null;
  }

  if (Array.isArray(errors)) {
    for (const error of errors) {
      const message = getFirstErrorMessage(error);
      if (message) {
        return message;
      }
    }
    return null;
  }

  if (typeof errors !== 'object') {
    return null;
  }

  const errorObject = errors as Record<string, unknown>;

  if (typeof errorObject.message === 'string' && errorObject.message.length > 0) {
    return errorObject.message;
  }

  if (errorObject.types && typeof errorObject.types === 'object') {
    const firstTypeMessage = Object.values(errorObject.types as Record<string, unknown>)[0];
    if (typeof firstTypeMessage === 'string' && firstTypeMessage.length > 0) {
      return firstTypeMessage;
    }
  }

  for (const value of Object.values(errorObject)) {
    const message = getFirstErrorMessage(value);
    if (message) {
      return message;
    }
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

  const handle = socialHandleRegex.test(trimmed)
    ? trimmed.replace(/^@/, '')
    : trimmed;

  if (!handle) return undefined;

  const base =
    platform === 'instagram'
      ? 'https://instagram.com'
      : platform === 'facebook'
        ? 'https://facebook.com'
        : platform === 'twitter'
          ? 'https://x.com'
          : '';

  if (base) {
    return `${base}/${handle}`;
  }

  return ensureHttps(trimmed);
};

interface EditProfileModalProps {
  isOpen: boolean;
  user: AuthUserDto;
  brandProfile: BrandProfileDto | null;
  showSkip?: boolean;
  onSkip?: () => void;
  onClose: () => void;
  onSaved: (user: AuthUserDto) => Promise<void> | void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  user,
  brandProfile,
  showSkip = false,
  onSkip,
  onClose,
  onSaved,
}) => {
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const tagSectionRef = useRef<HTMLDivElement | null>(null);
  const originalBodyOverflow = useRef<string | null>(null);

  const defaultCountry =
    brandProfile?.country ||
    user.brandCountry ||
    (LOCATION_DATA.some((country) => country.name === DEFAULT_COUNTRY)
      ? DEFAULT_COUNTRY
      : '');

  const initialValues = useMemo<ProfileFormValues>(() => {
    const tags =
      brandProfile?.tags ||
      brandProfile?.hashtags ||
      user.brandTags ||
      [];

    return {
      brandFullName:
        brandProfile?.brandFullName ||
        user.brandFullName ||
        `${user.firstName} ${user.lastName}`.trim() ||
        user.username,
      brandDescription:
        brandProfile?.description ||
        user.brandDescription ||
        '',
      brandCountry: defaultCountry,
      brandState: brandProfile?.state || user.brandState || '',
      brandCity: brandProfile?.city || user.brandCity || '',
      brandTags: Array.isArray(tags) ? tags.slice(0, 6) : [],
      socialInstagram:
        brandProfile?.socialLinks?.instagram || user.socialInstagram || '',
      socialFacebook:
        brandProfile?.socialLinks?.facebook || user.socialFacebook || '',
      socialTwitter:
        brandProfile?.socialLinks?.twitter || user.socialTwitter || '',
      socialWebsite:
        brandProfile?.socialLinks?.website || user.socialWebsite || '',
      phoneNumber:
        brandProfile?.contactInfo?.phone || user.phoneNumber || '',
      businessType:
        brandProfile?.contactInfo?.businessType ||
        user.brandBusinessType ||
        '',
    };
  }, [brandProfile, user, defaultCountry]);

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

  const selectedCountry = watch('brandCountry');
  const selectedState = watch('brandState');
  const selectedTags = watch('brandTags') || [];
  const selectedCity = watch('brandCity');
  const watchInstagram = watch('socialInstagram');
  const watchFacebook = watch('socialFacebook');
  const watchTwitter = watch('socialTwitter');
  const watchWebsite = watch('socialWebsite');

  const socialLinks = useMemo(
    () => ({
      instagram: normalizeSocialLink('instagram', watchInstagram),
      facebook: normalizeSocialLink('facebook', watchFacebook),
      twitter: normalizeSocialLink('twitter', watchTwitter),
      website: normalizeSocialLink('website', watchWebsite),
    }),
    [watchInstagram, watchFacebook, watchTwitter, watchWebsite],
  );

  const openLink = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const focusableFields = useMemo<ReadonlyArray<keyof ProfileFormValues>>(
    () => [
      'brandFullName',
      'brandDescription',
      'brandCountry',
      'brandState',
      'brandCity',
      'socialInstagram',
      'socialFacebook',
      'socialTwitter',
      'socialWebsite',
      'phoneNumber',
      'businessType',
    ],
    [],
  );

  const availableStates = useMemo(() => {
    const states = getStatesForCountry(selectedCountry || '');

    if (states.length === 0 && selectedCountry && selectedCountry.length > 0) {
      return [
        { name: selectedState || '', cities: [] },
        ...states,
      ];
    }

    return states;
  }, [selectedCountry, selectedState]);

  const availableCities = useMemo(
    () => getCitiesForState(selectedCountry || '', selectedState || ''),
    [selectedCountry, selectedState],
  );

  useEffect(() => {
    if (isOpen) {
      reset(initialValues);
      window.setTimeout(() => {
        descriptionRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialValues, reset]);

  useEffect(() => {
    if (isOpen) {
      originalBodyOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow =
          originalBodyOverflow.current ?? '';
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!availableStates.some((state) => state.name === selectedState)) {
      setValue('brandState', '');
      setValue('brandCity', '');
    }
  }, [availableStates, selectedState, setValue]);

  useEffect(() => {
    if (!availableCities.includes(selectedCity || '')) {
      setValue('brandCity', '');
    }
  }, [availableCities, selectedCity, setValue]);

  const toggleTag = (tag: string) => {
    const current = selectedTags || [];
    if (current.includes(tag)) {
      setValue(
        'brandTags',
        current.filter((item) => item !== tag),
        { shouldValidate: true },
      );
      return;
    }

    if (current.length >= 6) {
      toast.warning('You can select up to six tags');
      return;
    }

    setValue('brandTags', [...current, tag], { shouldValidate: true });
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  const onSubmit = useCallback(
    async (values: ProfileFormValues) => {
      try {
        const payload: UpdateBrandProfilePayload = {
          brandFullName: values.brandFullName.trim(),
          brandDescription: values.brandDescription.trim(),
          brandCountry: values.brandCountry ?? '',
          brandState: values.brandState ?? '',
          brandCity: values.brandCity ?? '',
          brandTags: values.brandTags,
          socialInstagram: normalizeSocialLink('instagram', values.socialInstagram),
          socialFacebook: normalizeSocialLink('facebook', values.socialFacebook),
          socialTwitter: normalizeSocialLink('twitter', values.socialTwitter),
          socialWebsite: normalizeSocialLink('website', values.socialWebsite),
          phoneNumber: values.phoneNumber?.trim() ?? '',
          businessType: values.businessType?.trim() ?? '',
        };

        const updatedUser = await brandApi.updateBrandProfile(user.id, payload);
        if (!updatedUser) {
          throw new Error('Profile update failed. Please try again.');
        }

        toast.success('Profile updated successfully');
        await onSaved(updatedUser);
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error('Unable to update profile. Please try again.');
        }
      }
    },
    [onSaved, user.id],
  );

  const onInvalid = useCallback(
    (formErrors: FieldErrors<ProfileFormValues>) => {
      const [firstErrorKey] = Object.keys(formErrors) as Array<keyof ProfileFormValues>;

      if (firstErrorKey === 'brandTags') {
        tagSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstTagButton = tagSectionRef.current?.querySelector<HTMLButtonElement>('button');
        firstTagButton?.focus();
      } else if (firstErrorKey && focusableFields.includes(firstErrorKey)) {
        setFocus(firstErrorKey);
      }

      const message = getFirstErrorMessage(formErrors);
      toast.error(message ?? 'Please fix the highlighted fields before saving.');
    },
    [focusableFields, setFocus],
  );

  const submitForm = useMemo(
    () => handleSubmit(onSubmit, onInvalid),
    [handleSubmit, onSubmit, onInvalid],
  );

  if (!isOpen) {
    return null;
  }

  if (import.meta.env.DEV) {
    console.log('[PROFILE_DEBUG][EditProfileModal] 🎭 Modal is rendering with full-screen overlay', {
      isOpen,
      showSkip,
      className: 'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm',
      message: 'This overlay covers the entire viewport - if you see blank page, modal content may be invisible',
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onClick={handleSkip}
    >
      <div
        className="relative w-full max-w-5xl glass-panel rounded-2xl shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 bg-gradient-to-r from-purple-400/30 via-purple-300/20 to-indigo-400/30 text-gray-900 dark:text-white backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-70">Brand setup</p>
            <h2 id="edit-profile-title" className="text-xl font-semibold">
              Update your profile
            </h2>
          </div>
          <IconButton
            type="button"
            onClick={handleSkip}
            aria-label="Close profile editor"
            variant="ghost"
            size="sm"
            icon={<X className="w-4 h-4" />}
          />
        </div>

        <form onSubmit={submitForm} className="px-6 py-6 space-y-6 overflow-y-auto max-h-[80vh] text-gray-900 dark:text-gray-100">
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1}>
            Submit
          </button>
          <section className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
            <div className="space-y-5">
              <div ref={tagSectionRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <input
                  value={user.username}
                  disabled
                  className="mt-1 w-full rounded-lg bg-white/40 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 backdrop-blur-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  value={user.email}
                  disabled
                  className="mt-1 w-full rounded-lg bg-white/40 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 backdrop-blur-xl"
                />
              </div>

              <div>
                <label htmlFor="brand-full-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Brand name
                </label>
                <input
                  id="brand-full-name"
                  {...register('brandFullName')}
                  className="mt-1 w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                  placeholder="Enter your brand name"
                />
                {errors.brandFullName && (
                  <p className="mt-1 text-xs text-red-500">{errors.brandFullName.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="brand-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    About your brand
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Minimum 20 characters
                  </span>
                </div>
                <textarea
                  id="brand-description"
                  {...brandDescriptionField}
                  ref={(element) => {
                    brandDescriptionField.ref(element);
                    descriptionRef.current = element;
                  }}
                  rows={5}
                  className="mt-1 w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                  placeholder="Share the story, inspiration, and mission behind your brand."
                />
                {errors.brandDescription && (
                  <p className="mt-1 text-xs text-red-500">{errors.brandDescription.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Brand tags
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Select up to 3 tags
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BRAND_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.value);
                    return (
                      <button
                        type="button"
                        key={tag.value}
                        onClick={() => toggleTag(tag.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all backdrop-blur-xl ${
                          isSelected
                            ? 'bg-purple-500/30 text-purple-900 dark:text-purple-100 border border-purple-400/40 ring-1 ring-purple-400/30'
                            : 'bg-white/40 dark:bg-white/5 text-gray-700 dark:text-gray-200 border border-white/30 dark:border-white/10 hover:bg-white/50'
                        }`}
                      >
                        #{tag.label ?? tag.value}
                      </button>
                    );
                  })}
                </div>
                {errors.brandTags && (
                  <p className="mt-1 text-xs text-red-500">{errors.brandTags.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Country
                  </label>
                  <div className="relative mt-1">
                    <select
                      {...register('brandCountry')}
                      className="w-full appearance-none rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                    >
                      <option value="">Select country</option>
                      {LOCATION_DATA.map((country) => (
                        <option key={country.name} value={country.name}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                    <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    State / Region
                  </label>
                  <select
                    {...register('brandState')}
                    className="mt-1 w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 disabled:opacity-60 backdrop-blur-xl"
                    disabled={!selectedCountry}
                  >
                    <option value="">Select state</option>
                    {availableStates.map((state) => (
                      state.name ? (
                        <option key={state.name} value={state.name}>
                          {state.name}
                        </option>
                      ) : null
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    City / Area
                  </label>
                  <select
                    {...register('brandCity')}
                    className="mt-1 w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 disabled:opacity-60 backdrop-blur-xl"
                    disabled={!selectedCountry || !selectedState}
                  >
                    <option value="">Select city</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone number
                  </label>
                  <input
                    {...register('phoneNumber')}
                    className="mt-1 w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                    placeholder="+234 800 000 0000"
                  />
                  {errors.phoneNumber && (
                    <p className="mt-1 text-xs text-red-500">{errors.phoneNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Business type
                  </label>
                  <input
                    {...register('businessType')}
                    className="mt-1 w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                    placeholder="e.g. Luxury womenswear"
                  />
                  {errors.businessType && (
                    <p className="mt-1 text-xs text-red-500">{errors.businessType.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Instagram
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      {...register('socialInstagram')}
                      className="w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 pr-11 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                      placeholder="@yourbrand or instagram.com/yourbrand"
                    />
                    <button
                      type="button"
                      onClick={() => openLink(socialLinks.instagram)}
                      disabled={!socialLinks.instagram}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/30 text-gray-800 hover:bg-white/50 disabled:opacity-40 dark:bg-white/5 dark:text-gray-100"
                      aria-label="Open Instagram link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.socialInstagram && (
                    <p className="mt-1 text-xs text-red-500">{errors.socialInstagram.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Facebook
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      {...register('socialFacebook')}
                      className="w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 pr-11 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                      placeholder="@yourbrand or facebook.com/yourbrand"
                    />
                    <button
                      type="button"
                      onClick={() => openLink(socialLinks.facebook)}
                      disabled={!socialLinks.facebook}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/30 text-gray-800 hover:bg-white/50 disabled:opacity-40 dark:bg-white/5 dark:text-gray-100"
                      aria-label="Open Facebook link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.socialFacebook && (
                    <p className="mt-1 text-xs text-red-500">{errors.socialFacebook.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Twitter / X
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      {...register('socialTwitter')}
                      className="w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 pr-11 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                      placeholder="@yourbrand or x.com/yourbrand"
                    />
                    <button
                      type="button"
                      onClick={() => openLink(socialLinks.twitter)}
                      disabled={!socialLinks.twitter}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/30 text-gray-800 hover:bg-white/50 disabled:opacity-40 dark:bg-white/5 dark:text-gray-100"
                      aria-label="Open Twitter link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.socialTwitter && (
                    <p className="mt-1 text-xs text-red-500">{errors.socialTwitter.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Website
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      {...register('socialWebsite')}
                      className="w-full rounded-lg bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-2 pr-11 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 backdrop-blur-xl"
                      placeholder="yourbrand.com or linktr.ee/brand"
                    />
                    <button
                      type="button"
                      onClick={() => openLink(socialLinks.website)}
                      disabled={!socialLinks.website}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/30 text-gray-800 hover:bg-white/50 disabled:opacity-40 dark:bg-white/5 dark:text-gray-100"
                      aria-label="Open website link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.socialWebsite && (
                    <p className="mt-1 text-xs text-red-500">{errors.socialWebsite.message}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse items-center gap-3 border-t border-white/20 pt-4 sm:flex-row sm:justify-between">
            <div className="text-xs text-gray-700 dark:text-gray-300 text-center sm:text-left">
              Complete your profile to appear in curated brand searches and collections.
            </div>
            <div className="flex items-center gap-2">
              {showSkip && (
                <FrostedButton type="button" variant="ghost" size="sm" onClick={handleSkip}>
                  Skip for now
                </FrostedButton>
              )}
              <FrostedButton
                type="button"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  if (!isSubmitting) {
                    void submitForm();
                  }
                }}
              >
                {isSubmitting ? 'Saving…' : 'Save profile'}
              </FrostedButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;

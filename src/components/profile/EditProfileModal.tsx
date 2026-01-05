
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
      brandTags: brandProfile?.tags || user.brandTags || [],
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
        
        // Reset state/city if not valid anymore (handled by user selection usually, but safe to clear if no match found effectively)
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
        // Using "selectedState" directly since API expects state name. 
        // If we had iso2 stored, we'd use that or map it. The select stores the Name.
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
      // Lock both HTML and BODY to prevent scroll chaining on mobile/all browsers
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
        const payload: UpdateBrandProfilePayload = {
          brandFullName: values.brandFullName.trim(),
          brandDescription: values.brandDescription.trim(),
          brandCountry: values.brandCountry ?? '',
          brandState: values.brandState ?? '',
          brandCity: values.brandCity ?? '',
          brandTags: values.brandTags || [],
          socialInstagram: normalizeSocialLink('instagram', values.socialInstagram),
          socialFacebook: normalizeSocialLink('facebook', values.socialFacebook),
          socialTwitter: normalizeSocialLink('twitter', values.socialTwitter),
          socialWebsite: normalizeSocialLink('website', values.socialWebsite),
          phoneNumber: values.phoneNumber?.trim() ?? '',
          businessType: values.businessType?.trim() ?? '',
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
    [onSaved, user.id, onClose],
  );

  const onInvalid = useCallback(
    (formErrors: FieldErrors<ProfileFormValues>) => {
      const message = getFirstErrorMessage(formErrors);
      toast.error(message ?? 'Please fix the highlighted fields before saving.');
      
      // Auto-focus first error
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
        </div>

        {/* Main Modal Container */}
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Brand setup">
          <div ref={dialogRef} tabIndex={-1} className="w-full max-w-2xl bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
          
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/50 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-5 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Brand Setup</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Update your profile details</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 group"
            >
              {/* X Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <form 
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="overflow-y-auto custom-scrollbar p-6 space-y-8 overscroll-contain"
          >
            
            {/* Section: Identity */}
            <div className="space-y-5">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white/90">Identity</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Brand Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Threadly Couture" 
                    className="w-full h-12 px-4 rounded-xl input-glass text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-0" 
                    {...register('brandFullName')}
                  />
                  {errors.brandFullName && <p className="text-xs text-red-500 ml-1">{errors.brandFullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">@</span>
                    <input 
                      type="text" 
                      placeholder="username" 
                      className="w-full h-12 pl-9 pr-4 rounded-xl input-glass text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 bg-gray-50/50 dark:bg-black/20 cursor-not-allowed opacity-80" 
                      value={user.username}
                      disabled
                    />
                  </div>
                </div>
                
                
                {/* Location Fields moved to Contact section */}


                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="contact@brand.com" 
                    className="w-full h-12 px-4 rounded-xl input-glass text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 bg-gray-50/50 dark:bg-black/20 cursor-not-allowed opacity-80" 
                    value={user.email}
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent"></div>

            {/* Section: Story */}
            <div className="space-y-5">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white/90">Brand Story</h3>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">About your brand</label>
                <textarea 
                  className="w-full h-40 p-4 rounded-xl input-glass text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 resize-none leading-relaxed focus:ring-0" 
                  placeholder="Tell the world about your vision, heritage, and what makes your fashion unique..."
                  {...brandDescriptionField}
                  ref={(e) => {
                      brandDescriptionField.ref(e);
                      descriptionRef.current = e;
                  }}
                ></textarea>
                <div className="absolute bottom-3 right-3 text-xs text-gray-500 dark:text-gray-400 font-medium bg-white/60 dark:bg-black/40 px-2 py-1 rounded backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  {descriptionValue?.length || 0} / 2000
                </div>
              </div>
              {errors.brandDescription && <p className="text-xs text-red-500 ml-1">{errors.brandDescription.message}</p>}
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent"></div>

            {/* Section: Contact & Biz */}
            <div className="space-y-5">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white/90">Contact & Business</h3>
              </div>

              {/* Location Fields */}
              <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Location</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <UniversalSelect
                          label=""
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
                          label=""
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
                          label=""
                          value={watch('brandCity') || ''}
                          onChange={(val) => setValue('brandCity', val)}
                          options={cityOptions}
                          placeholder={loadingLocations ? "Loading..." : "City"}
                          disabled={!selectedState || cityOptions.length === 0 || loadingLocations}
                          className="w-full"
                      />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 z-10">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Business Type</label>
                  <div className="relative">
                    <select className="w-full h-12 px-4 rounded-xl input-glass text-gray-900 dark:text-white appearance-none cursor-pointer focus:ring-0" {...register('businessType')}>
                      <option value="" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Select Type</option>
                      <option value="Retailer" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Retailer</option>
                      <option value="Designer" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Designer</option>
                      <option value="Wholesaler" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Wholesaler</option>
                      <option value="Boutique" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">Boutique</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="+1 (555) 000-0000" 
                    className="w-full h-12 px-4 rounded-xl input-glass text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-0"
                    {...register('phoneNumber')}
                  />
                  {errors.phoneNumber && <p className="text-xs text-red-500 ml-1">{errors.phoneNumber.message}</p>}
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Instagram Handle</label>
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
                      className="w-full h-12 pl-12 pr-4 rounded-xl input-glass text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-0"
                      {...register('socialInstagram')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden Submit for Enter Key */}
            <button type="submit" className="hidden" />
            
          </form>

          {/* Footer Actions */}
          <div className="p-6 bg-white/50 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-white/5 flex justify-end space-x-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => handleSubmit(onSubmit, onInvalid)()}
              disabled={isSubmitting}
              className="px-8 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#9333EA] hover:bg-purple-600 shadow-neon hover:shadow-neon-strong transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          </div>
        </div>
      </>
    </OverlayPortal>
  );
};

export default EditProfileModal;

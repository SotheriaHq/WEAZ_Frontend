import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { setUser } from '@/features/userSlice';
import {
  Save,
  User,
  MapPin,
  Globe,
  Phone,
  Instagram,
  Facebook,
  Twitter,
  Briefcase,
} from 'lucide-react';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import { toast } from 'sonner';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import UniversalSelect from '@/components/forms/UniversalSelect';
import MediaRenderer from '@/components/media/MediaRenderer';
import {
  LOCATION_FIELD_LABELS,
  locationService,
  type CountryOption,
  type StateOption,
} from '@/services/LocationService';
import {
  isEmptyPhone,
  isValidPhone,
  normalizePhoneToE164,
  PHONE_INVALID_MESSAGE,
  sanitizePhoneInput,
} from '@/utils/phoneNumber';

interface SettingsForm {
  brandFullName: string;
  brandDescription: string;
  brandCountry: string;
  brandState: string;
  brandCity: string;
  phoneNumber: string;
  businessType: string;
  socialInstagram: string;
  socialFacebook: string;
  socialTwitter: string;
  socialWebsite: string;
}

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.user.profile);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<SettingsForm>();

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const selectedCountry = watch('brandCountry');
  const selectedState = watch('brandState');
  const selectedCity = watch('brandCity');

  useEffect(() => {
    if (user) {
      reset({
        brandFullName: user.brandFullName || user.firstName + ' ' + user.lastName,
        brandDescription: user.brandDescription || '',
        brandCountry: user.brandCountry || '',
        brandState: user.brandState || '',
        brandCity: user.brandCity || '',
        phoneNumber: user.phoneNumber || '',
        businessType: user.brandBusinessType || '',
        socialInstagram: user.socialInstagram || '',
        socialFacebook: user.socialFacebook || '',
        socialTwitter: user.socialTwitter || '',
        socialWebsite: user.socialWebsite || '',
      });
    }
  }, [user, reset]);

  // Load countries once (same LocationService as EditProfileModal)
  useEffect(() => {
    let cancelled = false;
    setLoadingLocations(true);
    void locationService.getCountries().then((data) => {
      if (cancelled) return;
      setCountries(data);
      setLoadingLocations(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cascade: states when country changes
  useEffect(() => {
    let cancelled = false;
    if (!selectedCountry) {
      setStates([]);
      return;
    }
    setLoadingLocations(true);
    void locationService.getStates(selectedCountry).then((data) => {
      if (cancelled) return;
      setStates(data);
      setLoadingLocations(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry]);

  // Cascade: cities / LGAs when state changes
  useEffect(() => {
    let cancelled = false;
    if (!selectedCountry || !selectedState) {
      setCities([]);
      return;
    }
    setLoadingLocations(true);
    void locationService.getCities(selectedCountry, selectedState).then((data) => {
      if (cancelled) return;
      setCities(data);
      setLoadingLocations(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, selectedState]);

  const countryOptions = useMemo(
    () =>
      countries.map((c) => ({
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
      })),
    [countries],
  );

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s.name, label: s.name })),
    [states],
  );

  const cityOptions = useMemo(
    () => cities.map((c) => ({ value: c, label: c })),
    [cities],
  );

  const onSubmit = async (data: SettingsForm) => {
    if (!user?.id) return;
    try {
      const rawPhone = data.phoneNumber?.trim() ?? '';
      if (!isEmptyPhone(rawPhone) && !isValidPhone(rawPhone)) {
        toast.error(PHONE_INVALID_MESSAGE);
        return;
      }
      const payload = {
        ...data,
        brandCountry: data.brandCountry?.trim() || '',
        brandState: data.brandState?.trim() || '',
        brandCity: data.brandCity?.trim() || '',
        phoneNumber: isEmptyPhone(rawPhone)
          ? ''
          : (normalizePhoneToE164(rawPhone) ?? rawPhone),
      };
      const updatedUser = await brandApi.updateBrandProfile(user.id, payload);
      if (updatedUser) {
        dispatch(setUser(updatedUser));
        toast.success('Profile updated successfully');
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Update failed', error);
      toast.error('An error occurred while updating profile');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Update your brand profile and contact information.
          </p>
        </div>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || !isDirty}
          className="flex items-center gap-2 rounded-xl bg-[color:var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-[color:var(--brand-primary-strong)] disabled:opacity-50"
        >
          {isSubmitting ? (
            <MuseLoader size={16} />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Basic Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-transparent p-6 rounded-xl border border-gray-200/70 dark:border-white/10 space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Brand Name"
                placeholder="e.g. WIEZ Fashion"
                {...register('brandFullName')}
              />
              <Input
                label="Business Type"
                placeholder="e.g. Fashion Retailer"
                startIcon={<Briefcase className="w-4 h-4" />}
                {...register('businessType')}
              />
            </div>

            <Textarea
              label="Description"
              rows={4}
              placeholder="Tell us about your brand..."
              {...register('brandDescription')}
            />
          </div>

          <div className="bg-transparent p-6 rounded-xl border border-gray-200/70 dark:border-white/10 space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Location & Contact
            </h3>

            {/* Cascade: Country → State/Province → City/LGA (parity with EditProfileModal) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UniversalSelect
                label={LOCATION_FIELD_LABELS.country}
                value={selectedCountry || ''}
                onChange={(val) => {
                  setValue('brandCountry', val, { shouldDirty: true });
                  setValue('brandState', '', { shouldDirty: true });
                  setValue('brandCity', '', { shouldDirty: true });
                }}
                options={countryOptions}
                placeholder={loadingLocations && countries.length === 0 ? 'Loading...' : 'Select Country'}
                searchable
                searchPlaceholder="Search countries..."
                emptyMessage="No matching country found"
                disabled={loadingLocations && countries.length === 0}
                className="w-full min-w-0"
                optionAllowWrap
                selectedAllowWrap
              />
              <UniversalSelect
                label={LOCATION_FIELD_LABELS.state}
                value={selectedState || ''}
                onChange={(val) => {
                  setValue('brandState', val, { shouldDirty: true });
                  setValue('brandCity', '', { shouldDirty: true });
                }}
                options={stateOptions}
                placeholder={
                  !selectedCountry
                    ? 'Select country first'
                    : loadingLocations
                      ? 'Loading...'
                      : 'Select state / province'
                }
                searchable
                searchPlaceholder="Search states or provinces..."
                emptyMessage="No matching state or province found"
                disabled={!selectedCountry || (stateOptions.length === 0 && loadingLocations)}
                className="w-full min-w-0"
                optionAllowWrap
                selectedAllowWrap
              />
              <UniversalSelect
                label={LOCATION_FIELD_LABELS.city}
                value={selectedCity || ''}
                onChange={(val) => setValue('brandCity', val, { shouldDirty: true })}
                options={cityOptions}
                placeholder={
                  !selectedState
                    ? 'Select state first'
                    : loadingLocations
                      ? 'Loading...'
                      : 'Select city / LGA'
                }
                searchable
                searchPlaceholder="Search cities or LGAs..."
                emptyMessage="No matching city or LGA found"
                disabled={!selectedState || (cityOptions.length === 0 && loadingLocations)}
                className="w-full min-w-0"
                optionAllowWrap
                selectedAllowWrap
              />
            </div>

            <Input
              label="Phone Number"
              placeholder="080XXXXXXXX or +234..."
              startIcon={<Phone className="w-4 h-4" />}
              {...register('phoneNumber', {
                setValueAs: (value) => sanitizePhoneInput(String(value ?? '')),
              })}
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="space-y-6">
          <div className="bg-transparent p-6 rounded-xl border border-gray-200/70 dark:border-white/10 space-y-6 sticky top-24">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-400" />
              Social Media
            </h3>

            <div className="space-y-4">
              <Input
                label="Instagram"
                placeholder="@username"
                startIcon={<Instagram className="w-4 h-4" />}
                {...register('socialInstagram')}
              />
              <Input
                label="Facebook"
                placeholder="Page Name"
                startIcon={<Facebook className="w-4 h-4" />}
                {...register('socialFacebook')}
              />
              <Input
                label="Twitter / X"
                placeholder="@handle"
                startIcon={<Twitter className="w-4 h-4" />}
                {...register('socialTwitter')}
              />
              <Input
                label="Website"
                placeholder="https://..."
                startIcon={<Globe className="w-4 h-4" />}
                {...register('socialWebsite')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

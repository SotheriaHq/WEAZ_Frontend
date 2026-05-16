import React, { useEffect } from 'react';
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
  Briefcase
} from 'lucide-react';
import VLoader from '@/components/loaders/VLoader';
import { toast } from 'sonner';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';

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
  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<SettingsForm>();

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

  const onSubmit = async (data: SettingsForm) => {
    if (!user?.id) return;
    try {
      const updatedUser = await brandApi.updateBrandProfile(user.id, data);
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
          <p className="text-gray-500 dark:text-gray-400 text-sm">Update your brand profile and contact information.</p>
        </div>
        <button 
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || !isDirty}
          className="flex items-center gap-2 rounded-xl bg-[color:var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-[color:var(--brand-primary-strong)] disabled:opacity-50"
        >
          {isSubmitting ? (
            <VLoader size={16} phase="loading" showLabel={false} />
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
                placeholder="e.g. Threadly Fashion"
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Country"
                placeholder="Nigeria"
                {...register('brandCountry')}
              />
              <Input
                label="State"
                placeholder="Lagos"
                {...register('brandState')}
              />
              <Input
                label="City"
                placeholder="Ikeja"
                {...register('brandCity')}
              />
            </div>

            <Input
              label="Phone Number"
              placeholder="+234..."
              startIcon={<Phone className="w-4 h-4" />}
              {...register('phoneNumber')}
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

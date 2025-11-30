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
import { toast } from 'react-toastify';

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
          className="bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-xl font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-purple-500/20"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Basic Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand Name</label>
                <input 
                  {...register('brandFullName')}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="e.g. Threadly Fashion"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Business Type</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    {...register('businessType')}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    placeholder="e.g. Fashion Retailer"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea 
                {...register('brandDescription')}
                rows={4}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
                placeholder="Tell us about your brand..."
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Location & Contact
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                <input 
                  {...register('brandCountry')}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="Nigeria"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">State</label>
                <input 
                  {...register('brandState')}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="Lagos"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
                <input 
                  {...register('brandCity')}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="Ikeja"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  {...register('phoneNumber')}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="+234..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6 sticky top-24">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-400" />
              Social Media
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Instagram</label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    {...register('socialInstagram')}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    placeholder="@username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Facebook</label>
                <div className="relative">
                  <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    {...register('socialFacebook')}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    placeholder="Page Name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Twitter / X</label>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    {...register('socialTwitter')}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    placeholder="@username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    {...register('socialWebsite')}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

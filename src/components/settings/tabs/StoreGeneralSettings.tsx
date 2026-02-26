import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/Select';
import {
  Store,
  Palette,
  Power,
  Clock,
  ExternalLink,
  Camera,
  Bolt,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  closeStore,
  getStoreGeneralSettings,
  getStoreWizardPrefill,
  openStore,
  updateStorePolicies,
  updateStoreName,
  updateStoreProfile,
  type StoreGeneralSettingsResponse,
} from '@/api/StoreApi';

const MAX_CATEGORIES = 3;
const RESPONSE_TIME_OPTIONS = ['12h', '24h', '48h'];

const FALLBACK_CATEGORIES = [
  { value: 'african', label: 'African Fashion' },
  { value: 'western', label: 'Western Fashion' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'sustainable', label: 'Sustainable' },
  { value: 'plus-size', label: 'Plus Size' },
  { value: 'modest', label: 'Modest Fashion' },
];

const StoreGeneralSettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [storeNamePassword, setStoreNamePassword] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [responseTime, setResponseTime] = useState('24h');
  const [brandColor, setBrandColor] = useState('#8B5CF6');
  const [isLive, setIsLive] = useState(false);

  const [systemCategories, setSystemCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [initialSettings, setInitialSettings] = useState<StoreGeneralSettingsResponse | null>(null);

  const categories = useMemo(() => {
    if (systemCategories.length) {
      return systemCategories.map((c) => ({ value: c.slug, label: c.name }));
    }
    return FALLBACK_CATEGORIES;
  }, [systemCategories]);

  const toggleCategory = useCallback((value: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(value)) return prev.filter((item) => item !== value);
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, value];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const settings = await getStoreGeneralSettings();
        if (cancelled) return;

        setStoreName(settings.storeName || '');
        setSlug(settings.slug || '');
        setTagline(settings.tagline || '');
        setDescription(settings.description || '');
        setContactEmail(settings.contactEmail || '');
        setSelectedCategories(settings.tags || []);
        const resolvedResponseTime = RESPONSE_TIME_OPTIONS.includes(settings.responseTimeSla || '')
          ? (settings.responseTimeSla as string)
          : '24h';
        setResponseTime(resolvedResponseTime);
        setIsLive(Boolean(settings.isStoreOpen));
        setInitialSettings(settings);
      } catch (error) {
        console.error('Failed to load store settings', error);
        toast.error('Failed to load store settings. Please refresh and try again.');
      }

      try {
        const prefill = await getStoreWizardPrefill();
        if (!cancelled) {
          setSystemCategories(prefill.system?.categories ?? []);
        }
      } catch (error) {
        console.error('Failed to load store categories', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const storeNameChanged = initialSettings ? storeName.trim() !== initialSettings.storeName : false;
  const normalizedTagSnapshot = selectedCategories.slice().sort().join('|');
  const normalizedInitialTags = (initialSettings?.tags || []).slice().sort().join('|');

  const isDirty = Boolean(
    initialSettings && (
      tagline.trim() !== (initialSettings.tagline || '') ||
      description.trim() !== (initialSettings.description || '') ||
      contactEmail.trim() !== (initialSettings.contactEmail || '') ||
      normalizedTagSnapshot !== normalizedInitialTags ||
      responseTime !== (RESPONSE_TIME_OPTIONS.includes(initialSettings.responseTimeSla || '')
        ? (initialSettings.responseTimeSla as string)
        : '24h')
    )
  );

  const nextNameChangeAt = initialSettings?.storeNameNextAllowedAt
    ? new Date(initialSettings.storeNameNextAllowedAt)
    : null;
  const nameChangeLocked = Boolean(nextNameChangeAt && nextNameChangeAt.getTime() > Date.now());

  const handleSaveSettings = async () => {
    if (!initialSettings) return;

    setIsSaving(true);
    try {
      await Promise.all([
        updateStoreProfile({
          tagline: tagline.trim(),
          description: description.trim(),
          tags: selectedCategories,
          contactEmail: contactEmail.trim(),
        }),
        updateStorePolicies({
          responseTimeSla: responseTime,
        }),
      ]);

      setInitialSettings({
        ...initialSettings,
        tagline: tagline.trim(),
        description: description.trim(),
        tags: selectedCategories,
        contactEmail: contactEmail.trim(),
        responseTimeSla: responseTime,
      });

      toast.success('Store settings updated.');
    } catch (error) {
      console.error('Failed to save store settings', error);
      toast.error('Failed to save store settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStoreNameSave = async () => {
    if (!storeNameChanged || nameChangeLocked || !storeNamePassword.trim()) {
      return;
    }

    setIsSavingName(true);
    try {
      const updated = await updateStoreName({
        newName: storeName.trim(),
        currentPassword: storeNamePassword,
      });

      setStoreName(updated.storeName || '');
      setSlug(updated.slug || '');
      setInitialSettings(updated);
      setStoreNamePassword('');
      toast.success('Store name updated.');
    } catch (error) {
      console.error('Failed to update store name', error);
      toast.error('Unable to update store name. Please verify your password.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    const nextLiveState = !isLive;

    try {
      if (nextLiveState) {
        await openStore();
      } else {
        await closeStore();
      }
      setIsLive(nextLiveState);
      toast.success(nextLiveState ? 'Store is now live.' : 'Store is now paused.');
    } catch (error: any) {
      console.error('Failed to update store status', error);
      const missingFields: string[] | undefined =
        error?.response?.data?.missingFields ??
        error?.response?.data?.data?.missingFields;

      if (Array.isArray(missingFields) && missingFields.length > 0) {
        toast.error(`Complete: ${missingFields.join(', ')}`);
      } else {
        toast.error('Unable to update store status.');
      }
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const colorPresets = ['#3B82F6', '#8B5CF6', '#10B981', '#EF4444', '#F59E0B'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">General Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your store's basic information and branding.
          </p>
        </div>
        <a
          href="#"
          className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          View Store
        </a>
      </div>

      {/* Basic Information */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Store className="w-5 h-5 text-purple-500" />
          Basic Information
        </h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Store Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Store Name</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={isLoading}
                className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-60"
              />
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={storeNamePassword}
                  onChange={(e) => setStoreNamePassword(e.target.value)}
                  placeholder="Confirm password to save"
                  disabled={isLoading || nameChangeLocked}
                  className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleStoreNameSave}
                  disabled={isLoading || isSavingName || !storeNameChanged || nameChangeLocked || !storeNamePassword.trim()}
                  className="w-fit px-4 py-2 rounded-lg bg-white/70 dark:bg-white/10 hover:bg-white text-gray-700 dark:text-white text-sm font-medium border border-gray-200 dark:border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingName ? 'Saving...' : 'Save Store Name'}
                </button>
              </div>
              {nameChangeLocked && nextNameChangeAt && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Store name can be changed again on {nextNameChangeAt.toLocaleDateString()}.
                </p>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.value);
                  const isDisabled = !isSelected && selectedCategories.length >= MAX_CATEGORIES;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      disabled={isDisabled || isLoading}
                      className={
                        'rounded-full px-3 py-1.5 text-xs font-medium border transition-all ' +
                        (isSelected
                          ? 'bg-purple-600 text-white border-purple-600'
                          : isDisabled
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300 hover:text-purple-600')
                      }
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">{selectedCategories.length} of {MAX_CATEGORIES} selected</p>
            </div>
          </div>

          {/* Store Slug */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Store URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400 text-sm">threadly.store/</span>
              <input
                type="text"
                value={slug}
                disabled
                className="flex-1 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white opacity-70 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Slug is tied to your username. Update it from profile settings.
            </p>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 60))}
              maxLength={60}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-60"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
              {tagline.length}/60 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-all disabled:opacity-60"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-60"
            />
          </div>
        </div>
      </section>

      {/* Branding */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" />
          Branding
        </h2>

        <div className="space-y-8">
          {/* Store images are profile-derived (read-only here) */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Store banner & logo</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Your store uses your brand profile banner and profile photo. To keep things consistent, images cannot be changed from store settings.
                </p>
                <a
                  href="/profile/settings"
                  className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Update images in Profile Settings
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Brand Color */}
          <div className="pt-4 border-t border-gray-200 dark:border-white/5">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-3">
              Brand Accent Color
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex gap-3">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrandColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      brandColor === color
                        ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1a1a] ring-white'
                        : 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1a1a] ring-transparent hover:ring-white/50'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-white/10" />
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/20"
                  style={{ backgroundColor: brandColor }}
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-24 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm font-mono uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store Status & Response Time Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Status */}
        <section className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Power className="w-5 h-5 text-purple-500" />
              Store Status
            </h2>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                isLive
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20'
                  : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              {isLive ? 'LIVE' : 'PAUSED'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {isLive
              ? 'Your store is currently visible to customers and accepting orders.'
              : 'Your store is paused and not accepting new orders.'}
          </p>

          <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/5">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Need a break?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Temporarily pause new orders.</p>
            </div>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={isTogglingStatus || isLoading}
              className="px-4 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTogglingStatus ? 'Updating...' : isLive ? 'Go On Break' : 'Go Live'}
            </button>
          </div>
          <div className="mt-4 text-right">
            <a href="#" className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              View status history
            </a>
          </div>
        </section>

        {/* Response Time */}
        <section className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              Response Time
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
                Commitment to Customers
              </label>
              <Select
                  value={responseTime}
                  onChange={(e) => setResponseTime(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="12h">Within 12 hours</option>
                  <option value="24h">Within 24 hours</option>
                  <option value="48h">Within 48 hours</option>
                </Select>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                <Bolt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase tracking-wide">
                  Current Performance
                </p>
                <p className="text-gray-900 dark:text-white font-semibold">Avg. 4.2 hours</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 z-20 flex items-center justify-end gap-4 py-4 bg-gradient-to-t from-white dark:from-[#0f0f0f] via-white/90 dark:via-[#0f0f0f]/90 to-transparent">
        <button
          type="button"
          onClick={() => {
            if (!initialSettings) return;
            setTagline(initialSettings.tagline || '');
            setDescription(initialSettings.description || '');
            setContactEmail(initialSettings.contactEmail || '');
            setSelectedCategories(initialSettings.tags || []);
            const resolvedResponseTime = RESPONSE_TIME_OPTIONS.includes(initialSettings.responseTimeSla || '')
              ? (initialSettings.responseTimeSla as string)
              : '24h';
            setResponseTime(resolvedResponseTime);
          }}
          className="px-6 py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium text-sm transition-colors"
        >
          Discard Changes
        </button>
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={!isDirty || isSaving || isLoading}
          className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default StoreGeneralSettings;

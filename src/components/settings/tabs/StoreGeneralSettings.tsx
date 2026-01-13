import React, { useState } from 'react';
import { 
  Store, 
  Palette, 
  Power, 
  Clock, 
  Check, 
  AlertTriangle,
  ExternalLink,
  Camera,
  Bolt
} from 'lucide-react';

/**
 * Store General Settings
 * Manage store's basic information, branding, and status
 */
const StoreGeneralSettings: React.FC = () => {
  // Form state
  const [storeName, setStoreName] = useState('Urban Threads Co.');
  const [category, setCategory] = useState('Fashion & Apparel');
  const [slug, setSlug] = useState('urban-threads');
  const [tagline, setTagline] = useState('Sustainable fashion for the modern soul.');
  const [description, setDescription] = useState(
    'We curate high-quality, sustainable fashion pieces that help you express your unique style while caring for the planet. Founded in 2023.'
  );
  const [brandColor, setBrandColor] = useState('#8B5CF6');
  const [isLive, setIsLive] = useState(true);
  const [responseTime, setResponseTime] = useState('24');
  const [slugAvailable, setSlugAvailable] = useState(true);

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
              <div className="relative">
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-gray-700 dark:text-white px-2 py-1 rounded transition-colors">
                  Save
                </button>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 appearance-none cursor-pointer transition-all"
                >
                  <option>Fashion & Apparel</option>
                  <option>Accessories</option>
                  <option>Home & Living</option>
                  <option>Art & Collectibles</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
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
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugAvailable(e.target.value.length > 3);
                }}
                className="flex-1 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
              {slugAvailable ? (
                <span className="text-green-500 text-xs flex items-center gap-1">
                  <Check className="w-3 h-3" /> Available
                </span>
              ) : (
                <span className="text-red-500 text-xs">Taken</span>
              )}
            </div>
            <div className="flex items-start gap-2 mt-2 bg-yellow-500/10 dark:bg-yellow-500/5 p-3 rounded-lg border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Changing your slug will break existing links to your store. We'll set up a temporary redirect for 30 days.
              </p>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 60))}
              maxLength={60}
              className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
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
              className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-all"
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
                  Your store uses your brand profile banner and profile photo. To keep things consistent, images can’t be changed from store settings.
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
              onClick={() => setIsLive(!isLive)}
              className="px-4 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-white/10 transition-all"
            >
              {isLive ? 'Go On Break' : 'Go Live'}
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
              <div className="relative">
                <select
                  value={responseTime}
                  onChange={(e) => setResponseTime(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 appearance-none cursor-pointer transition-all"
                >
                  <option value="12">Within 12 hours</option>
                  <option value="24">Within 24 hours</option>
                  <option value="48">Within 48 hours</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
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
        <button className="px-6 py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium text-sm transition-colors">
          Discard Changes
        </button>
        <button className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default StoreGeneralSettings;

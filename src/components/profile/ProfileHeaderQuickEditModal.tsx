
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { BRAND_TAG_OPTIONS, BRAND_TAG_SELECTION_LIMIT } from '../../data/brandTags';
import { IconButton } from '@/components/ui/FrostedButton';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// ----------------------------------------------------------------------------
// Zod Schema
// ----------------------------------------------------------------------------
const schema = z.object({
  brandFullName: z.string().trim().min(2, { message: 'Brand name must be at least 2 characters' }).max(120),
  brandCountry: z.string().trim().max(120).optional(),
  brandState: z.string().trim().max(120).optional(),
  brandCity: z.string().trim().max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------------
// Component Props
// ----------------------------------------------------------------------------
interface ProfileHeaderQuickEditModalProps {
  open: boolean;
  initialValues: {
    brandFullName: string;
    brandCountry?: string | null;
    brandState?: string | null;
    brandCity?: string | null;
    brandTags: string[];
    username?: string;
  };
  onSubmit: (values: FormValues & { brandTags: string[] }) => Promise<void>;
  onClose: () => void;
  onOpenFullEditor?: () => void;
  saving?: boolean;
}

const MAX_TAGS = BRAND_TAG_SELECTION_LIMIT;

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------
const ProfileHeaderQuickEditModal: React.FC<ProfileHeaderQuickEditModalProps> = ({
  open,
  initialValues,
  onSubmit,
  onClose,
  onOpenFullEditor,
  saving = false,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap({
        active: open,
        containerRef: dialogRef,
        onEscape: onClose,
    });

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      brandFullName: initialValues.brandFullName,
      brandCountry: initialValues.brandCountry ?? '',
      brandState: initialValues.brandState ?? '',
      brandCity: initialValues.brandCity ?? '',
    },
  });

  const [selectedTags, setSelectedTags] = useState<string[]>(initialValues.brandTags ?? []);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({
        brandFullName: initialValues.brandFullName,
        brandCountry: initialValues.brandCountry ?? '',
        brandState: initialValues.brandState ?? '',
        brandCity: initialValues.brandCity ?? '',
      });
      setSelectedTags((initialValues.brandTags ?? []).slice(0, MAX_TAGS));
      setTagError(null);
    }
  }, [open, initialValues, reset]);

  const toggleTag = (value: string) => {
    setSelectedTags((previous) => {
      if (previous.includes(value)) {
        const next = previous.filter((tag) => tag !== value);
        if (tagError && next.length > 0) setTagError(null);
        return next;
      }
      if (previous.length >= MAX_TAGS) {
        setTagError(`Choose up to ${MAX_TAGS} tags.`);
        return previous;
      }
      const next = [...previous, value];
      if (tagError && next.length > 0) setTagError(null);
      return next;
    });
  };

  const handleFormSubmit = handleSubmit(async (values) => {
    if (selectedTags.length === 0) {
      setTagError('Select at least one tag.');
      return;
    }
    await onSubmit({ ...values, brandTags: selectedTags });
  });

  // Scroll Locking
  useEffect(() => {
    if (open) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
        <OverlayPortal>
            <>
                {/* Background Overlay */}
                <div className="fixed inset-0 z-layer-overlay transition-opacity">
                    {/* Glow Effect behind modal placement - optional ambient lighting */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[500px] w-[500px] mx-auto bg-purple-500/20 dark:bg-purple-900/40 blur-[100px] rounded-full opacity-50 pointer-events-none" />
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
                </div>

                {/* Main Modal Container - Floating Pane */}
                <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Quick edit">
                    <div ref={dialogRef} tabIndex={-1} className="relative w-full max-w-2xl neu-modal-surface bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header / Drag Handle area */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/80 shadow-sm"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500/80 shadow-sm"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-500/80 shadow-sm"></div>
                    </div>
                    <h2 className="text-sm font-medium tracking-widest text-gray-500 dark:text-white/60 uppercase">Quick Edit</h2>
                    <IconButton
                        aria-label="Close"
                        icon={<span className="text-sm">✕</span>}
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={saving}
                    />
                </div>

                {/* Scrollable Content */}
                <form 
                    className="p-6 space-y-8 overflow-y-auto custom-scrollbar max-h-[70vh] overscroll-contain" 
                    onSubmit={(e) => { e.preventDefault(); void handleFormSubmit(); }}
                >
                    
                    {/* Top Section: Context (Locked) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 dark:text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span className="text-xs font-semibold text-gray-400 dark:text-white/40 uppercase tracking-wider">Identity (Read Only)</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Brand Name (Edit Disabled but visible) */}
                            <div className="group/input relative">
                                <label className="block text-xs text-gray-500 dark:text-white/50 mb-1.5 ml-1">Brand Name</label>
                                <div className="flex items-center px-4 py-3 bg-gray-100/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl text-gray-500 dark:text-white/60 cursor-not-allowed backdrop-blur-sm">
                                    <span className="font-medium text-theme-secondary">{initialValues.brandFullName}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 dark:text-white/10 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </div>
                                <input type="hidden" {...register('brandFullName')} />
                            </div>
                            
                            {/* Username */}
                            <div className="group/input relative">
                                <label className="block text-xs text-gray-500 dark:text-white/50 mb-1.5 ml-1">Username</label>
                                <div className="flex items-center px-4 py-3 bg-gray-100/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl text-gray-500 dark:text-white/60 cursor-not-allowed backdrop-blur-sm">
                                    <span className="font-medium text-theme-secondary">@{initialValues.username}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 dark:text-white/10 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-500 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-200 uppercase tracking-wider">Location Details</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Country */}
                            <div className="md:col-span-4">
                                <label className="block text-xs text-gray-500 dark:text-white/70 mb-1.5 ml-1">Country</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        placeholder="Country"
                                        className="w-full bg-white/60 dark:bg-white/5 border border-theme rounded-xl px-4 py-3 text-theme focus:outline-none focus:border-purple-500 focus:ring-0 transition-all duration-300 placeholder-gray-400"
                                        {...register('brandCountry')}
                                    />
                                </div>
                            </div>

                            {/* State */}
                            <div className="md:col-span-4">
                                <label className="block text-xs text-gray-500 dark:text-white/70 mb-1.5 ml-1">State / Province</label>
                                <input 
                                    type="text" 
                                    placeholder="State"
                                    className="w-full bg-white/60 dark:bg-white/5 border border-theme rounded-xl px-4 py-3 text-theme focus:outline-none focus:border-purple-500 focus:ring-0 transition-all duration-300 placeholder-gray-400"
                                    {...register('brandState')}
                                />
                            </div>

                            {/* City */}
                            <div className="md:col-span-4">
                                <label className="block text-xs text-gray-500 dark:text-white/70 mb-1.5 ml-1">City</label>
                                <input 
                                    type="text" 
                                    placeholder="City"
                                    className="w-full bg-white/60 dark:bg-white/5 border border-theme rounded-xl px-4 py-3 text-theme focus:outline-none focus:border-purple-500 focus:ring-0 transition-all duration-300 placeholder-gray-400"
                                    {...register('brandCity')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Hero Feature: Tag Cloud */}
                    <div className="space-y-5 pt-2">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-xl font-bold text-theme mb-1 flex items-center gap-2">
                                    Brand Vibe
                                    <span className="text-xs font-normal text-gray-500 dark:text-white/40 surface-control-muted px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/5">Select up to {MAX_TAGS}</span>
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-white/50">Tap tags to define your aesthetic.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 p-6 bg-gray-50/50 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5 inner-shadow">
                            {BRAND_TAG_OPTIONS.map((tag) => {
                                const isSelected = selectedTags.includes(tag.value);
                                return (
                                    <button
                                        key={tag.value}
                                        type="button"
                                        onClick={() => toggleTag(tag.value)}
                                        disabled={saving}
                                        aria-pressed={isSelected}
                                        className={`group relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:-translate-y-0.5 ${
                                            isSelected 
                                                ? 'bg-purple-600 border border-purple-500 text-white shadow-neon' 
                                                : 'bg-white/60 dark:bg-white/5 border border-theme text-gray-600 dark:text-white/70 hover:bg-white dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/30'
                                        }`}
                                    >
                                        <span className="relative z-10 flex items-center gap-2">
                                            #{tag.label}
                                            {isSelected && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {tagError && <p className="text-sm text-red-500 font-medium">{tagError}</p>}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 bg-transparent flex flex-col gap-4">
                        <button 
                            type="submit"
                            disabled={saving}
                            aria-busy={saving}
                            className="w-full relative group overflow-hidden rounded-xl py-4 font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 bg-purple-600"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                            <span className="relative z-10 flex min-w-[12rem] items-center justify-center gap-2 text-lg tracking-wide">
                                {saving ? 'Saving changes...' : 'Save Changes'}
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${saving ? 'opacity-0' : 'opacity-100 group-hover:translate-x-1'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </span>
                        </button>
                        
                        {onOpenFullEditor && (
                            <div className="text-center">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenFullEditor();
                                    }}
                                    className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 hover:text-purple-600 dark:hover:text-white transition-colors duration-300 group"
                                >
                                    <span>Open Full Editor</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="7" y1="17" x2="17" y2="7"></line>
                                        <polyline points="7 7 17 7 17 17"></polyline>
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </form>

                                </div>
                            </div>
                        </>
                </OverlayPortal>
  );
};

export default ProfileHeaderQuickEditModal;

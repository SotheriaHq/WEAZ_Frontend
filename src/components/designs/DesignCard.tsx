import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { messagingApi } from '@/api/MessagingApi';
import { toast } from 'sonner';
import ThreadButton from '@/components/ui/ThreadButton';
import CommentInput from '@/components/ui/CommentInput';
import type { MarketItem } from '@/types/market';
import MediaRenderer from '@/components/media/MediaRenderer';
import { apiClient } from '@/api/httpClient';
import { Link, Tag } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import { useBrandPatchState } from '@/context/BrandPatchContext';

interface DesignCardProps {
  item: MarketItem;
  onOpenView?: (item: MarketItem) => void;
  onViewCollection?: (collectionId: string) => void;
  onViewBrand?: (brandId: string, item: MarketItem) => void;
  className?: string;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
  saveBusy?: boolean;
  isPatched?: boolean;
  onTogglePatch?: (brandId: string) => void;
  patchBusy?: boolean;
}

export const DesignCard: React.FC<DesignCardProps> = ({
  item,
  onOpenView,
  onViewCollection,
  onViewBrand,
  className,
  isSaved: isSavedProp,
  onToggleSave,
  saveBusy: saveBusyProp,
  isPatched: isPatchedProp,
  onTogglePatch,
  patchBusy: patchBusyProp,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isVideo = Boolean(item.media.type?.toUpperCase().includes('VIDEO'));
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const user = useSelector((s: RootState) => s.user.profile);
  const [isHidden, setIsHidden] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showCustomLabel, setShowCustomLabel] = useState(false);
  const [isSavedLocal, setIsSavedLocal] = useState(false);
  const [saveBusyLocal, setSaveBusyLocal] = useState(false);
  const isRegular = user?.type === 'REGULAR';
  const {
    isPatchCapable,
    getPatched,
    isLoading: isPatchLoading,
    ensureStatus,
    toggleStatus,
  } = useBrandPatchState();
  const isSaveControlled = typeof isSavedProp === 'boolean' && typeof onToggleSave === 'function';
  const isPatchControlled = typeof isPatchedProp === 'boolean' && typeof onTogglePatch === 'function';
  const resolvedSaved = isSaveControlled ? (isSavedProp as boolean) : isSavedLocal;
  const resolvedSaveBusy = isSaveControlled ? Boolean(saveBusyProp) : saveBusyLocal;
  const resolvedPatched = isPatchControlled
    ? (isPatchedProp as boolean)
    : getPatched(item.brandId);
  const resolvedPatchBusy = isPatchControlled
    ? Boolean(patchBusyProp)
    : isPatchLoading(item.brandId);
  
  // Check if item is hidden in local storage on mount
  useEffect(() => {
    const hiddenItems = JSON.parse(localStorage.getItem('hiddenMarketItems') || '[]');
    if (hiddenItems.includes(item.id)) {
      setIsHidden(true);
    }
  }, [item.id]);

  useEffect(() => {
    let mounted = true;
    const loadSaved = async () => {
      if (isSaveControlled) return;
      if (!isAuth) {
        if (mounted) setIsSavedLocal(false);
        return;
      }
      try {
        const res = await apiClient.get('/saved/check', {
          params: { targetType: 'COLLECTION_MEDIA', targetId: item.id },
        });
        if (mounted) {
          setIsSavedLocal(Boolean(res.data?.isSaved));
        }
      } catch {
        if (mounted) setIsSavedLocal(false);
      }
    };
    void loadSaved();
    return () => { mounted = false; };
  }, [isAuth, item.id, isSaveControlled]);

  useEffect(() => {
    if (isPatchControlled) return;
    if (!isAuth || !isPatchCapable || !item.brandId) return;
    void ensureStatus(item.brandId);
  }, [ensureStatus, isAuth, isPatchCapable, item.brandId, isPatchControlled]);

  // Use Redux selector for real-time comment count synchronization
  const handleHideContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) { toast.info('Please sign in to manage content preferences.'); return; }
    
    const hiddenItems = JSON.parse(localStorage.getItem('hiddenMarketItems') || '[]');
    if (!hiddenItems.includes(item.id)) {
      hiddenItems.push(item.id);
      localStorage.setItem('hiddenMarketItems', JSON.stringify(hiddenItems));
    }
    setIsHidden(true);
    setShowMenu(false);
    toast.info('Content hidden. You can undo this in Settings.');
  };

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaveControlled) {
      onToggleSave?.(item.id);
      return;
    }
    if (user?.id && item.brandId && user.id === item.brandId) {
      toast.info('Brands cannot save their own products.');
      return;
    }
    if (!isAuth) { toast.info('Please sign in to save items.'); return; }
    if (saveBusyLocal) return;
    try {
      setSaveBusyLocal(true);
      if (isSavedLocal) {
        await apiClient.delete('/saved', {
          data: { targetType: 'COLLECTION_MEDIA', targetId: item.id },
        });
        setIsSavedLocal(false);
        toast.success('Removed from saved.');
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION_MEDIA', targetId: item.id });
        setIsSavedLocal(true);
        toast.success('Saved for later.');
      }
    } catch {
      toast.error('Unable to update saved items.');
    } finally {
      setSaveBusyLocal(false);
      setShowMenu(false);
    }
  };

  const handleTogglePatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPatchControlled) {
      if (item.brandId) {
        onTogglePatch?.(item.brandId);
      }
      return;
    }
    if (!isAuth) { toast.info('Please sign in to patch brands.'); return; }
    if (!isPatchCapable || !item.brandId) return;
    try {
      const nextPatched = await toggleStatus(item.brandId);
      toast.success(nextPatched ? 'Brand patched.' : 'Brand unpatched.');
    } catch {
      toast.error('Unable to update patch.');
    }
    setShowMenu(false);
  };

  if (isHidden) return null;

  const isCustomAvailable = item.customAvailable === true;

  const brandAvatar = resolveProfileImageSource({
    brandLogo: item.brandLogo,
    brandLogoFileId: item.brandLogoFileId,
  });
  const brandAvatarFallback = getAvatarFallback(item.brandName ?? null, item.username ?? null);

  return (
    <article
      className={`group relative w-full overflow-hidden rounded-xl transition-all duration-300 hover:shadow-xl cursor-pointer ${className ?? ''}`}
      onClick={() => {
        if (onOpenView) {
          onOpenView(item);
        } else {
          onViewCollection?.(item.collectionId);
        }
      }}
      onMouseLeave={() => {
        setShowMenu(false);
        setShowTags(false);
        setShowCustomLabel(false);
      }}
    >
      {/* Full Image Background */}
      <div className="relative w-full h-full">
        {isVideo ? (
          <MediaRenderer
            kind="video"
            src={item.media.url ?? ''}
            poster={item.media.previewUrl ?? undefined}
            controls={false}
            fit="contain"
            maxHeightClassName="max-h-none"
            maxWidthClassName="max-w-full"
            className="w-full h-full"
            mediaClassName="w-full h-full object-contain"
          />
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-purple-100/40 via-white/40 to-white/20 dark:from-purple-900/20 dark:via-purple-900/10 dark:to-gray-900/40" />
            )}
            <MediaRenderer
              kind="image"
              src={item.media.url ?? ''}
              alt={item.collectionTitle}
              fit="contain"
              maxHeightClassName="max-h-none"
              maxWidthClassName="max-w-full"
              className={`w-full h-full transition-opacity duration-500 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              mediaClassName="w-full h-full object-contain"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgLoaded(true);
              }}
            />
          </>
        )}
        
        {/* Gradient Overlay for Text Readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Tag Button */}
        <div className="absolute top-3 left-3 z-20">
           <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTags(!showTags);
            }}
            className="hover:scale-110 transition-transform drop-shadow-md"
            title="View Tags"
          >
            <Tag className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
          {showTags && item.tags && item.tags.length > 0 && (
            <div className="absolute top-8 left-0 flex flex-wrap gap-1 w-48 animate-in fade-in zoom-in-95 duration-100">
               {item.tags.map(tag => (
                 <span key={tag} className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-medium border border-white/10">
                   #{tag}
                 </span>
               ))}
            </div>
          )}
          {isCustomAvailable && (
            <div className="relative mt-2 inline-flex">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCustomLabel((prev) => !prev);
                }}
                onMouseEnter={() => setShowCustomLabel(true)}
                onMouseLeave={() => setShowCustomLabel(false)}
                onFocus={() => setShowCustomLabel(true)}
                onBlur={() => setShowCustomLabel(false)}
                className="inline-flex items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/25 px-2 py-1 text-sm leading-none text-white shadow-md"
                aria-label="Custom available"
                title="Custom available"
              >
                <span role="img" aria-hidden="true">{String.fromCodePoint(0x2702, 0xfe0f)}</span>
              </button>
              {showCustomLabel && (
                <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-full bg-black/80 px-2 py-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur whitespace-nowrap">
                  Custom Available
                </span>
              )}
            </div>
          )}
        </div>

        {/* Context Menu (Three Dots) */}
        <div className="absolute top-3 right-3 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-full text-white/90 hover:text-white transition-colors drop-shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-40 rounded-lg bg-white/90 dark:bg-black/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right z-40">
              {isCustomAvailable && (
                <>
                  <div className="w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <span role="img" aria-hidden="true">{String.fromCodePoint(0x2702, 0xfe0f)}</span>
                    <span>Custom Available</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-white/10 my-0.5" />
                </>
              )}
              <button
                onClick={handleToggleSave}
                disabled={resolvedSaveBusy}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 transition-colors disabled:opacity-60"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                {resolvedSaved ? 'Unsave' : 'Save'}
              </button>
              {isRegular && item.brandId && (
                <>
                  <div className="h-px bg-gray-200 dark:bg-white/10 my-0.5" />
                  <button
                    onClick={handleTogglePatch}
                    disabled={resolvedPatchBusy}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 transition-colors disabled:opacity-60"
                  >
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    {resolvedPatched ? 'Unpatch brand' : 'Patch brand'}
                  </button>
                </>
              )}
              <div className="h-px bg-gray-200 dark:bg-white/10 my-0.5" />
              <button
                onClick={handleHideContent}
                className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Stop seeing this
              </button>
            </div>
          )}
        </div>

        {/* Vertical Action Bar (Right Side - Instagram/TikTok Style) */}
        <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
          <ThreadButton
            contentType="COLLECTION_MEDIA"
            contentId={item.id}
            initialCount={item.threadsCount ?? 0}
            initialThreaded={item.isThreaded}
            ownerId={item.brandId}
            parentCollectionId={item.collectionId}
          />
          
          <button 
            className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // Handle share action
            }}
            aria-label="Share"
            title="Share collection"
          >
            <Link className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold mt-1 drop-shadow">{item.collectionCollabCount ?? 0}</span>
          </button>
        </div>

        {/* Bottom Content Overlay */}
        {/* FIX #6: Responsive padding for different screen sizes */}
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 md:p-4 text-white z-10">
          {/* Brand Info with Glassmorphism */}
          {/* FIX #6: Responsive padding and spacing */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewBrand?.(item.brandId, item);
            }}
            className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 w-fit rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-all"
          >
            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/60 shadow-md">
              <ImageWithFallback
                src={brandAvatar.src}
                fileId={brandAvatar.fileId}
                alt={item.brandName ?? item.username ?? 'Brand'}
                fit="cover"
                rounded="full"
                fallbackName={brandAvatarFallback}
                containerClassName="h-8 w-8 rounded-full"
                className="h-8 w-8 object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 text-left">
              {/* FIX #5: Responsive font sizing, removed truncate, allow wrapping with line-clamp */}
              <p 
                className="font-bold leading-tight text-white drop-shadow line-clamp-2"
                style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)' }}
              >
                {item.brandName ?? item.username ?? 'Brand'}
              </p>
              {item.username && item.brandName !== item.username && (
                <p 
                  className="leading-tight text-white/80 line-clamp-1"
                  style={{ fontSize: 'clamp(0.625rem, 2vw, 0.75rem)' }}
                >
                  @{item.username}
                </p>
              )}
            </div>
          </button>

          {/* Collection Title - Fancy Typography */}
          {/* FIX #5: Responsive title sizing */}
          <h3 
            className="font-bold mb-1 line-clamp-2 leading-tight drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-white"
            style={{ 
              fontFamily: 'Georgia, "Playfair Display", serif', 
              fontWeight: 700, 
              letterSpacing: '0.03em', 
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
            }}
          >
            {item.collectionTitle}
          </h3>

          {/* Comment Input Area (Bottom) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <CommentInput
                value={commentText}
                onChange={setCommentText}
                onSubmit={async () => {
                  if (!isAuth) { toast.info('Please sign in to message.'); return; }
                  const content = commentText.trim();
                  if (!content || content.length > 4000) { toast.error('Message must be 1-4000 characters.'); return; }
                  if (!item.brandId) { toast.error('Brand is unavailable for this design.'); return; }
                  setCommentBusy(true);
                  try {
                    await messagingApi.sendBrandMessage(item.brandId, {
                      bodyText: content,
                      clientMessageId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    });
                    setCommentText('');
                    toast.success('Message sent');
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message ?? 'Failed to send message');
                  } finally { setCommentBusy(false); }
                }}
                placeholder="Message brand..."
                maxLength={4000}
                disabled={commentBusy}
                busy={commentBusy}
                className="w-full"
                variant="overlay"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default DesignCard;


import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { messagingApi } from '@/api/MessagingApi';
import { toast } from 'sonner';
import ThreadButton from '@/components/ui/ThreadButton';
import InlineTextInput from '@/components/ui/CommentInput';
import type { MarketItem } from '@/types/market';
import MediaRenderer from '@/components/media/MediaRenderer';
import { apiClient } from '@/api/httpClient';
import { Link, Tag } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import { useBrandPatchState } from '@/context/BrandPatchContext';
import { patchMenuRowColorClasses, patchToastMessage } from '@/lib/patchPresentation';
import { useNavigate } from 'react-router-dom';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { useBagFlow } from '@/features/bagging/BagFlowProvider';
import {
  ownsDesignBrand as checkOwnsDesignBrand,
  runDesignBagFlow,
} from '@/features/bagging/designBagActions';
import {
  BRAND_BAG_BLOCKED_MESSAGE,
  isBrandAccountBlockedFromBagging,
} from '@/lib/baggingAccess';
import { BAG_IT_LABEL } from '@/constants/bagging';
import { formatPrice } from '@/utils/helpers';

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
  const navigate = useNavigate();
  const isVideo = Boolean(item.media.type?.toUpperCase().includes('VIDEO'));
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const bagFlow = useBagFlow();
  const [directMessageText, setDirectMessageText] = useState('');
  const [directMessageBusy, setDirectMessageBusy] = useState(false);
  const [bagBusy, setBagBusy] = useState(false);
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
      toast.success(patchToastMessage(nextPatched, item.brandName));
    } catch {
      toast.error('Unable to update patch.');
    }
    setShowMenu(false);
  };

  if (isHidden) return null;

  const isCustomAvailable = item.customAvailable === true;
  const brandId = typeof item.brandId === 'string' ? item.brandId.trim() : '';
  const ownsDesignBrand = checkOwnsDesignBrand(user, brandId);
  const brandBagBlocked = isBrandAccountBlockedFromBagging(user);
  const bagDisabled = bagBusy || ownsDesignBrand || brandBagBlocked;
  const canMessageBrand = Boolean(brandId) && !ownsDesignBrand;

  const handleBagDesign = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isCustomAvailable) return;
    if (bagBusy) return;
    if (brandBagBlocked) {
      toast.info(BRAND_BAG_BLOCKED_MESSAGE);
      return;
    }

    setBagBusy(true);
    try {
      await runDesignBagFlow({
        item,
        user,
        isAuthenticated: isAuth,
        bagFlow,
      });
    } finally {
      setBagBusy(false);
    }
  };

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
          <ImageWithFallback
              /* Grid cards must use the small 640px CARD variant (previewUrl),
                 NOT the 1440–2048px full-screen `url` — loading the high-res
                 image into a ~300px card is what made the runway render one
                 card at a time. The modal still opens the full-res `url`. */
              src={item.media.previewUrl ?? item.media.url ?? ''}
              fileId={item.media.fileId || null}
              alt={item.collectionTitle}
              fit="contain"
              rounded="none"
              containerClassName="h-full w-full"
              maxHeightClassName="max-h-none"
              className="h-full w-full object-contain"
              fallbackName={item.collectionTitle}
              /* Document-scrolled feed: defer off-screen card images so the
                 first screenful loads immediately instead of all cards
                 contending and painting one at a time. In-viewport cards still
                 load right away (native lazy loads what's already visible). */
              loading="lazy"
            />
        )}
        
        {/* Gradient Overlay for Text Readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Tag Button */}
        <div className="hidden md:block absolute top-2 left-2 z-20 scale-[0.72] origin-top-left sm:top-3 sm:left-3 sm:scale-100">
           <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTags(!showTags);
            }}
            className="hover:scale-110 transition-transform drop-shadow-md"
            title="View Tags"
          >
            <Tag className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden="true" />
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
                className="inline-flex items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/25 px-1.5 py-0.5 text-[10px] leading-none text-white shadow-md sm:px-2 sm:py-1 sm:text-sm"
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
        <div className="hidden md:block absolute top-2 right-2 z-30 scale-[0.72] origin-top-right sm:top-3 sm:right-3 sm:scale-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-0.5 rounded-full text-white/90 hover:text-white transition-colors drop-shadow-md sm:p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-6 sm:w-6">
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
                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-60 ${patchMenuRowColorClasses(
                      resolvedPatched,
                    )}`}
                  >
                    <span aria-hidden="true">{resolvedPatched ? '✓' : '🧵'}</span>
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
        <div className="hidden md:flex absolute bottom-10 right-1 z-10 flex flex-col items-center gap-1 sm:bottom-20 sm:right-3 sm:gap-2.5">
          {isCustomAvailable ? (
            <button
              type="button"
              className="flex origin-bottom-right scale-[0.95] flex-col items-center text-white transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60 sm:scale-100"
              onClick={handleBagDesign}
              disabled={bagDisabled}
              aria-label={BAG_IT_LABEL}
              title={
                brandBagBlocked
                  ? BRAND_BAG_BLOCKED_MESSAGE
                  : ownsDesignBrand
                    ? 'Brands cannot bag their own designs'
                    : BAG_IT_LABEL
              }
            >
              <BagPulseIcon
                status={bagBusy ? 'bagging' : bagDisabled ? 'disabled' : 'not_bagged'}
                context="rail"
                size={34}
                disabled={bagDisabled}
              />
              <span className="text-[9px] font-bold mt-0.5 drop-shadow sm:text-xs sm:mt-1">{BAG_IT_LABEL}</span>
            </button>
          ) : null}

          <div className="flex origin-bottom-right scale-[0.62] flex-col items-center gap-1 sm:scale-[0.88] sm:gap-2 lg:scale-100 lg:gap-3">
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
              <Link className="h-3.5 w-3.5 sm:h-5 sm:w-5" aria-hidden="true" />
              <span className="text-[8px] font-bold mt-0.5 drop-shadow sm:text-xs sm:mt-1">{item.collectionCollabCount ?? 0}</span>
            </button>
          </div>
        </div>

        {/* Desktop Bottom Content Overlay */}
        <div className="hidden md:block absolute bottom-0 left-0 right-0 p-1.5 sm:p-3 md:p-4 text-white z-10">
          {/* Brand Info with Glassmorphism */}
          {/* FIX #6: Responsive padding and spacing */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewBrand?.(item.brandId, item);
            }}
            className="flex items-center gap-1.5 mb-0.5 w-fit rounded-lg py-0.5 transition-all sm:gap-2 sm:mb-1 sm:py-1"
          >
            <div className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-lg border border-white/40 shadow-md sm:h-8 sm:w-8 sm:rounded-xl">
              <ImageWithFallback
                src={brandAvatar.src}
                fileId={brandAvatar.fileId}
                alt={item.brandName ?? item.username ?? 'Brand'}
                fit="cover"
                rounded="xl"
                fallbackName={brandAvatarFallback}
                containerClassName="h-6 w-6 rounded-lg sm:h-8 sm:w-8 sm:rounded-xl"
                className="h-6 w-6 object-cover sm:h-8 sm:w-8"
              />
            </div>
            <div className="min-w-0 text-left">
              {/* FIX #5: Responsive font sizing, removed truncate, allow wrapping with line-clamp */}
              <p 
                className="font-bold leading-tight text-white drop-shadow line-clamp-2"
                style={{ fontSize: 'clamp(0.5625rem, 2vw, 0.875rem)' }}
              >
                {item.brandName ?? item.username ?? 'Brand'}
              </p>
              {item.username && item.brandName !== item.username && (
                <p 
                  className="leading-tight text-white/80 line-clamp-1"
                  style={{ fontSize: 'clamp(0.5rem, 1.6vw, 0.75rem)' }}
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
              fontSize: 'clamp(0.625rem, 2vw, 1rem)'
            }}
          >
            {item.collectionTitle}
          </h3>

          {/* Direct message input area (bottom) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <InlineTextInput
                value={directMessageText}
                onChange={setDirectMessageText}
                onSubmit={async () => {
                  if (!isAuth) {
                    toast.info('Please sign in to message this brand.');
                    const next = `${window.location.pathname}${window.location.search}`;
                    navigate(`/login?next=${encodeURIComponent(next)}`);
                    return;
                  }
                  const content = directMessageText.trim();
                  if (!content || content.length > 4000) { toast.error('Message must be 1-4000 characters.'); return; }
                  if (!brandId) { toast.error('Brand is unavailable for this design.'); return; }
                  if (ownsDesignBrand) { toast.info('This is your design.'); return; }
                  setDirectMessageBusy(true);
                  try {
                    const result = await messagingApi.sendBrandMessage(brandId, {
                      bodyText: content,
                      clientMessageId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                      contextDesignId: item.designId ?? undefined,
                      contextDesignTitle: item.collectionTitle,
                      contextDesignCoverFileId: item.coverMediaId ?? item.media.fileId ?? undefined,
                      contextDesignCoverUrl: item.media.url ?? item.media.previewUrl ?? undefined,
                    });
                    setDirectMessageText('');
                    toast.success('Message sent');
                    const threadId = result?.thread?.id;
                    if (threadId) {
                      navigate(`/messages?thread=${encodeURIComponent(threadId)}`);
                    }
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message ?? 'Failed to send message');
                  } finally { setDirectMessageBusy(false); }
                }}
                placeholder={ownsDesignBrand ? 'Your design' : canMessageBrand ? 'Message brand...' : 'Brand unavailable'}
                maxLength={4000}
                disabled={directMessageBusy || ownsDesignBrand}
                busy={directMessageBusy}
                className="w-full"
                variant="overlay"
                size="compact"
                submitAriaLabel="Send direct message"
              />
            </div>
          </div>
        </div>

        {/* Mobile View Bottom Overlay */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 p-1.5 bg-black/45 backdrop-blur-md z-10 flex items-center justify-between min-h-[32px] max-h-[38px] border-t border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1 min-w-0 flex flex-col justify-center pl-1">
            <h3 
              className="font-bold text-white truncate leading-none uppercase"
              style={{ fontSize: '12px' }}
            >
              {item.collectionTitle}
            </h3>
            {(() => {
              const min = typeof item.minPrice === 'number' ? formatPrice(item.minPrice) : undefined;
              const max = typeof item.maxPrice === 'number' ? formatPrice(item.maxPrice) : undefined;
              const displayPrice = min && max ? `${min} - ${max}` : min ? `${min}+` : max ? `Up to ${max}` : null;
              return displayPrice ? (
                <span className="text-white/85 leading-none mt-0.5" style={{ fontSize: '12px' }}>
                  {displayPrice}
                </span>
              ) : null;
            })()}
          </div>
          
          {/* Mobile Bag It Feature inline in the bottom bar */}
          {isCustomAvailable && (
            <button
              type="button"
              className="flex items-center justify-center p-0.5 text-white hover:scale-110 transition-transform mr-1 shrink-0"
              onClick={handleBagDesign}
              disabled={bagDisabled}
              aria-label={BAG_IT_LABEL}
              title={
                brandBagBlocked
                  ? BRAND_BAG_BLOCKED_MESSAGE
                  : ownsDesignBrand
                    ? 'Brands cannot bag their own designs'
                    : BAG_IT_LABEL
              }
            >
              <BagPulseIcon
                status={bagBusy ? 'bagging' : bagDisabled ? 'disabled' : 'not_bagged'}
                context="rail"
                size={24}
                disabled={bagDisabled}
              />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default DesignCard;

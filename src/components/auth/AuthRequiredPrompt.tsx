import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogIn, UserPlus, ShoppingBag, Heart, Sparkles, Lock } from 'lucide-react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { BAG_IT_EMOJI, MY_BAG_EMOJI } from '@/constants/bagging';

interface AuthRequiredPromptProps {
  /** Whether the prompt is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
  /** Feature that requires auth */
  feature?: 'cart' | 'wishlist' | 'checkout' | 'profile' | 'default';
  /** Optional close behavior for login/signup navigation when the pending action must persist. */
  onAuthNavigate?: () => void;
}

/**
 * AuthRequiredPrompt - Beautiful authentication prompt modal
 * 
 * Shows when unauthenticated users try to access protected features.
 * Design: Glassmorphism with animated gradients and engaging copy.
 */
const AuthRequiredPrompt: React.FC<AuthRequiredPromptProps> = ({
  isOpen,
  onClose,
  title,
  description,
  feature = 'default',
  onAuthNavigate,
}) => {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: isOpen,
    onEscape: onClose,
  });

  // Feature-specific content
  const featureContent: Record<string, { icon: React.ReactNode; title: string; description: string; emoji: string }> = {
    cart: {
      icon: <ShoppingBag className="w-8 h-8" />,
      title: 'Sign in to view your bag',
      description: 'Create an account or sign in to save items, track orders, and enjoy a personalized shopping experience.',
      emoji: MY_BAG_EMOJI,
    },
    wishlist: {
      icon: <Heart className="w-8 h-8" />,
      title: 'Sign in to view your wishlist',
      description: 'Save your favorite designs and get notified when they go on sale or are back in stock.',
      emoji: '💜',
    },
    checkout: {
      icon: <Lock className="w-8 h-8" />,
      title: 'Sign in to checkout',
      description: 'Create an account to complete your purchase and track your orders.',
      emoji: '🔐',
    },
    profile: {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'Sign in to view your profile',
      description: 'Access your collections, orders, and personalized recommendations.',
      emoji: '✨',
    },
    default: {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'Sign in to continue',
      description: 'Create an account or sign in to access all features and enjoy a personalized experience.',
      emoji: '🌟',
    },
  };

  const content = featureContent[feature];
  const displayTitle = title || content.title;
  const displayDescription = description || content.description;

  const handleSignIn = () => {
    if (onAuthNavigate) onAuthNavigate();
    else onClose();
    navigate('/login');
  };

  const handleSignUp = () => {
    if (onAuthNavigate) onAuthNavigate();
    else onClose();
    navigate('/signup');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <OverlayPortal>
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-layer-overlay"
              onClick={onClose}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-black/40" />
            </motion.div>

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={displayTitle}
            >
              <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative w-full max-w-md bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden"
              >
                {/* Gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />
                
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Content */}
                <div className="p-8 pt-10 text-center">
                {/* Icon with glow */}
                <motion.div
                  className="relative inline-block mb-6"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center text-purple-500 dark:text-purple-400">
                      {content.icon}
                    </div>
                    <span className="absolute -top-2 -right-2 text-3xl">{content.emoji}</span>
                  </div>
                  <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full -z-10" />
                </motion.div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {displayTitle}
                </h2>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  {displayDescription}
                </p>

                {/* Benefits list */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-8">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                    Why join Threadly?
                  </h4>
                  <ul className="space-y-2 text-left">
                    {[
                      `${BAG_IT_EMOJI} Shop exclusive African fashion`,
                      '💜 Save favorites to your wishlist',
                      '📦 Track your orders easily',
                      '🎁 Get personalized recommendations',
                    ].map((benefit, index) => (
                      <motion.li
                        key={benefit}
                        className="flex items-center text-sm text-gray-700 dark:text-gray-300"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <span className="mr-2">{benefit.split(' ')[0]}</span>
                        <span>{benefit.split(' ').slice(1).join(' ')}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Action buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  >
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </button>
                  <button
                    onClick={handleSignUp}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold transition-all"
                  >
                    <UserPlus className="w-5 h-5" />
                    Create Account
                  </button>
                </div>

                {/* Footer */}
                <p className="mt-6 text-xs text-gray-500 dark:text-gray-500">
                  By continuing, you agree to our Terms of Service and Privacy Policy
                </p>
                </div>
              </div>
            </motion.div>
          </>
        </OverlayPortal>
      )}
    </AnimatePresence>
  );
};

export default AuthRequiredPrompt;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlassBackdropProps {
  isVisible: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  zIndex?: number;
  /** Use lighter variant for non-modal overlays like sidebars */
  variant?: 'default' | 'light' | 'dark';
}

/**
 * GlassBackdrop Component
 * 
 * A unified gradient blur backdrop for modals and overlays.
 * Implements the Threadly design system with:
 * - Multi-layer gradient (purple → indigo → blue)
 * - Backdrop blur for glassmorphism effect
 * - Dark overlay for content contrast
 * 
 * @example
 * <GlassBackdrop isVisible={isOpen} onClick={onClose}>
 *   <ModalContent />
 * </GlassBackdrop>
 */
const GlassBackdrop: React.FC<GlassBackdropProps> = ({
  isVisible,
  onClick,
  children,
  className = '',
  zIndex = 50,
  variant = 'default',
}) => {
  const gradientStyles = {
    default: {
      gradient: 'from-purple-900/40 via-indigo-900/50 to-blue-900/40',
      overlay: 'bg-black/40',
    },
    light: {
      gradient: 'from-purple-900/20 via-indigo-900/30 to-blue-900/20',
      overlay: 'bg-black/20',
    },
    dark: {
      gradient: 'from-purple-900/60 via-indigo-900/70 to-blue-900/60',
      overlay: 'bg-black/60',
    },
  };

  const styles = gradientStyles[variant];

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop layers */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 ${className}`}
            style={{ zIndex }}
            onClick={onClick}
          >
            {/* Gradient layer */}
            <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient}`} />
            {/* Blur layer */}
            <div className="absolute inset-0 backdrop-blur-xl" />
            {/* Dark overlay */}
            <div className={`absolute inset-0 ${styles.overlay}`} />
          </motion.div>

          {/* Content - rendered above backdrop */}
          {children && (
            <div className="fixed inset-0" style={{ zIndex: zIndex + 1 }}>
              {children}
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * useGlassBackdrop Hook
 * 
 * Returns the CSS classes needed for the glass backdrop effect.
 * Use this when you can't use the GlassBackdrop component directly.
 * 
 * @example
 * const { backdropClasses, gradientClass, blurClass, overlayClass } = useGlassBackdrop();
 */
export const useGlassBackdrop = (variant: 'default' | 'light' | 'dark' = 'default') => {
  const gradientStyles = {
    default: {
      gradientClass: 'bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40',
      overlayClass: 'bg-black/40',
    },
    light: {
      gradientClass: 'bg-gradient-to-br from-purple-900/20 via-indigo-900/30 to-blue-900/20',
      overlayClass: 'bg-black/20',
    },
    dark: {
      gradientClass: 'bg-gradient-to-br from-purple-900/60 via-indigo-900/70 to-blue-900/60',
      overlayClass: 'bg-black/60',
    },
  };

  const styles = gradientStyles[variant];

  return {
    gradientClass: styles.gradientClass,
    blurClass: 'backdrop-blur-xl',
    overlayClass: styles.overlayClass,
    /**
     * Use these as separate layers:
     * <div className={gradientClass} />
     * <div className={blurClass} />
     * <div className={overlayClass} />
     */
  };
};

/**
 * Glass Panel Classes
 * 
 * Standard classes for glass-morphism panels (modals, drawers, cards)
 */
export const glassPanelClasses = {
  /** Light mode panel */
  light: 'bg-white/95 backdrop-blur-2xl border border-white/20 shadow-2xl',
  /** Dark mode panel */
  dark: 'bg-gray-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl',
  /** Auto mode (responds to theme) */
  auto: 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl',
};

export default GlassBackdrop;

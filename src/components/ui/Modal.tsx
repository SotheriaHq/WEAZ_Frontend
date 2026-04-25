import React from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { OverlayPortal } from './OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  scope?: 'viewport' | 'parent';
  backdropStyle?: 'default' | 'light';
  /** Use the unified glass backdrop style */
  glassBackdrop?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  size = 'md',
  className,
  scope = 'viewport',
  backdropStyle = 'default',
  glassBackdrop = true,
}) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
  });

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  // Scroll Locking
  React.useEffect(() => {
    if (open && scope === 'viewport') {
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

  const modalContent = (
    <div
      className={clsx(
        scope === 'viewport' ? 'fixed' : 'absolute',
        'inset-0 z-layer-modal'
      )}
      aria-hidden={false}
    >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
              onClick={onClose}
            >
              {glassBackdrop ? (
                <>
                  <div
                    className={clsx(
                      'absolute inset-0',
                      backdropStyle === 'light'
                        ? 'bg-gradient-to-br from-slate-700/12 via-indigo-700/10 to-sky-700/12'
                        : 'bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40'
                    )}
                  />
                  <div
                    className={clsx(
                      'absolute inset-0',
                      backdropStyle === 'light' ? 'backdrop-blur-md' : 'backdrop-blur-xl'
                    )}
                  />
                  <div
                    className={clsx(
                      'absolute inset-0',
                      backdropStyle === 'light' ? 'bg-black/12' : 'bg-black/40'
                    )}
                  />
                </>
              ) : (
                <div
                  className={clsx(
                    'absolute inset-0',
                    scope === 'parent'
                      ? 'bg-gradient-to-br from-slate-900/20 via-slate-800/16 to-indigo-900/20 backdrop-blur-[2px]'
                      : 'bg-black/50 backdrop-blur-sm'
                  )}
                />
              )}
            </motion.div>

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-0 flex items-center justify-center p-4"
              onClick={onClose}
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={clsx(
                  'relative w-full neu-modal-surface rounded-2xl shadow-2xl overflow-hidden outline-none',
                  sizeClasses[size],
                  className
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                {title && (
                  <div className="flex items-center justify-between px-6 py-4">
                    <h2 className="text-xl font-bold text-[color:var(--neu-text)]">
                      {title}
                    </h2>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full neu-modal-inset transition-colors"
                      aria-label="Close modal"
                    >
                      <X size={20} className="text-[color:var(--neu-text-muted)]" />
                    </button>
                  </div>
                )}

                {/* Content */}
                <div className="px-6 pb-5 pt-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {children}
                </div>
              </div>
            </motion.div>
    </div>
  );

  return (
    <AnimatePresence>
      {open &&
        (scope === 'viewport' ? (
          <OverlayPortal>{modalContent}</OverlayPortal>
        ) : (
          modalContent
        ))}
    </AnimatePresence>
  );
};

export default Modal;

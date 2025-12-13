import React from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
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
  glassBackdrop = true,
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  // Scroll Locking
  React.useEffect(() => {
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

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
          >
            {glassBackdrop ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="absolute inset-0 bg-black/40" />
              </>
            ) : (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            )}
          </motion.div>

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className={clsx(
                'relative w-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden',
                sizeClasses[size],
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {title}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Close modal"
                  >
                    <X size={20} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Modal;

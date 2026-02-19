import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DiscardChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
}

/**
 * Premium styled discard changes modal
 * Use instead of browser confirm() for better UX
 */
const DiscardChangesModal: React.FC<DiscardChangesModalProps> = ({
  isOpen,
  onClose,
  onDiscard,
  title = 'Discard Changes?',
  message = 'You have unsaved changes. Are you sure you want to discard them? This action cannot be undone.',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-300">
        <div className="bg-white dark:bg-zinc-900 neu-modal-surface rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 pb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {message}
            </p>
          </div>
          
          {/* Actions */}
          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl transition-colors"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={() => {
                onDiscard();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-xl shadow-md shadow-red-500/20 transition-all hover:shadow-lg"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscardChangesModal;

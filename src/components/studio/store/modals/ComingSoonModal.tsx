import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// COMING SOON MODAL
// Displayed for bulk operations and features not yet implemented
// ═══════════════════════════════════════════════════════════════════════════════

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  description?: string;
}

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
  feature = 'Bulk Operations',
  description = "We're working on powerful bulk editing tools to help you manage multiple products at once.",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 neu-modal-surface bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce-slow">
            <span className="text-5xl">🚀</span>
          </div>
          
          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {feature}
          </h2>
          
          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {description}
          </p>
          
          {/* Coming soon badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            Coming Soon
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ComingSoonModal;

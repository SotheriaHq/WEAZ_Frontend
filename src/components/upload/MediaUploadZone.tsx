import React from 'react';
import { motion } from 'framer-motion';
import { FiUpload, FiImage, FiFilm, FiCamera } from 'react-icons/fi';

interface PickerShape {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragActive: boolean;
  setIsDragActive: (v: boolean) => void;
  errors: string[];
  pendingCount: number;
  handlers: {
    onInputChange: React.ChangeEventHandler<HTMLInputElement>;
    onDrop: React.DragEventHandler<HTMLDivElement>;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
  };
  open: () => void;
}

interface MediaUploadZoneProps {
  onFilesUpload: (files: File[]) => void;
  picker: PickerShape;
  disabled?: boolean;
  maxFiles?: number;
}

/**
 * MediaUploadZone
 * 
 * A premium, immersive upload zone for the Collection Creation page.
 * Features drag & drop, visual feedback, and inspiring copy.
 */
const MediaUploadZone: React.FC<MediaUploadZoneProps> = ({
  // onFilesUpload is handled through picker.handlers.onInputChange
  picker,
  disabled = false,
  maxFiles = 20,
}) => {
  const { isDragActive, handlers, inputRef } = picker;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div
        className={`
          relative rounded-3xl border-2 border-dashed transition-all duration-500 overflow-hidden group
          ${isDragActive 
            ? 'border-purple-500 bg-purple-500/10 scale-[1.02] shadow-2xl shadow-purple-500/20' 
            : 'border-gray-300/30 dark:border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 hover:shadow-xl hover:shadow-purple-500/10'
          }
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDrop={disabled ? undefined : handlers.onDrop}
        onDragOver={disabled ? undefined : handlers.onDragOver}
        onDragLeave={disabled ? undefined : handlers.onDragLeave}
        onClick={() => {
          if (!disabled) picker.open();
        }}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br from-purple-600/5 via-indigo-600/5 to-blue-600/5 transition-opacity duration-500 ${isDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
        
        {/* Content */}
        <div className="relative py-20 px-8 text-center flex flex-col items-center justify-center min-h-[400px]">
          {/* Icon */}
          <motion.div 
            className="mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:scale-110 transition-transform duration-500"
            animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
          >
            <FiUpload className={`w-10 h-10 ${isDragActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400 transition-colors duration-300'}`} />
          </motion.div>

          {/* Main text */}
          <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
            {isDragActive ? 'Drop your files here' : 'Drag & drop your fashion imagery'}
          </h3>
          <p className="text-gray-400 mb-8 text-lg font-light">
            or click to browse from your device
          </p>

          {/* Supported formats */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <FormatBadge icon={<FiImage className="w-4 h-4" />} formats="JPG, PNG, WEBP" />
            <FormatBadge icon={<FiFilm className="w-4 h-4" />} formats="MP4, MOV" />
          </div>

          {/* Upload limit info */}
          <p className="text-sm text-gray-500">
            Up to {maxFiles} files • Images & videos supported
          </p>

          {/* Action buttons (mobile) */}
          <div className="flex items-center justify-center gap-3 mt-6 sm:hidden">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-light border border-white/10 text-white text-sm font-medium hover:border-purple-500/50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                picker.open();
              }}
              disabled={disabled}
            >
              <FiImage className="w-4 h-4" />
              Browse Gallery
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-light border border-white/10 text-white text-sm font-medium hover:border-purple-500/50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // Camera capture would require capture attribute
              }}
              disabled={disabled}
            >
              <FiCamera className="w-4 h-4" />
              Take Photo
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handlers.onInputChange}
          className="hidden"
          accept="image/*,video/*"
          disabled={disabled}
        />
      </div>

      {/* Error messages */}
      {picker.errors.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 space-y-1"
        >
          {picker.errors.map((err, i) => (
            <p key={i} className="text-sm text-red-400">
              {err}
            </p>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

/**
 * FormatBadge - Shows supported file formats
 */
const FormatBadge: React.FC<{ icon: React.ReactNode; formats: string }> = ({ icon, formats }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-light border border-white/10">
    <span className="text-gray-400">{icon}</span>
    <span className="text-xs text-gray-300 font-medium">{formats}</span>
  </div>
);

export default MediaUploadZone;

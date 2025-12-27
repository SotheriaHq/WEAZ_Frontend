import React from 'react';
import { FiX } from 'react-icons/fi';
import MediaRenderer from '@/components/media/MediaRenderer';

interface ProfileImageModalProps {
  open: boolean;
  src?: string | null;
  alt?: string;
  onClose: () => void;
}

const ProfileImageModal: React.FC<ProfileImageModalProps> = ({ open, src, alt = 'Profile image', onClose }) => {
  if (!open || !src) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute top-6 right-6 rounded-full bg-white/90 p-2 text-gray-900 shadow-lg transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-gray-900/80 dark:text-gray-100"
        onClick={onClose}
        aria-label="Close image preview"
      >
        <FiX className="h-5 w-5" />
      </button>
      <figure className="relative max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl shadow-2xl">
        <MediaRenderer
          kind="image"
          src={src}
          alt={alt}
          maxHeightClassName="max-h-[90vh]"
          className="rounded-3xl"
          mediaClassName="rounded-3xl"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2 text-center text-sm font-medium text-white">
          {alt}
        </figcaption>
      </figure>
    </div>
  );
};

export default ProfileImageModal;

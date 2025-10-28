import React from "react";
import type { MarketMedia } from "@/types/market";

// Minimal shape derived from backend /collections/:id
type CollectionDetail = {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
};

type Props = {
  open: boolean;
  collection: CollectionDetail | null;
  media: MarketMedia[];
  onClose: () => void;
};

const CollectionViewModal: React.FC<Props> = ({ open, collection, media, onClose }) => {
  // Early return if not open or no collection
  if (!open || !collection) return null;

  // Use collection data to avoid unused parameter warning
  const title = collection.title;
  const mediaCount = media?.length || 0;

  // Basic modal structure - implementation can be expanded later
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 rounded-lg">
        <h2>{title}</h2>
        <p>Media items: {mediaCount}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default CollectionViewModal;

"use client";

import { useState } from "react";
import { Eye, Download, Image as ImageIcon } from "lucide-react";

export type Photo = {
  id: string;
  thumbnailUrl: string;
  photoUrl: string;
  downloadUrl: string;
  tags?: {
    runner: {
      bibNumber: string;
    };
  }[];
};

type Props = {
  photo: Photo;
  onView: (photo: Photo) => void;
};

export function PhotoCard({ photo, onView }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative group aspect-square bg-gray-200 rounded overflow-hidden">
      {/* Loading skeleton */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-gray-300 animate-pulse" />
      )}

      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="text-center text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Image unavailable</p>
          </div>
        </div>
      )}

      {/* Image */}
      <img
        src={photo.thumbnailUrl}
        alt="Race photo"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          imageLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={(e) => {
          console.error("Image failed to load:", photo.id);

          // Try proxy fallback
          if (!e.currentTarget.src.includes("/api/photos")) {
            e.currentTarget.src = `/api/photos/${photo.id}/proxy?type=thumbnail`;
          } else {
            setImageError(true);
          }
        }}
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Action buttons */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <button
            onClick={() => onView(photo)}
            className="bg-white text-black p-3 rounded-full hover:bg-gray-200"
          >
            <Eye className="w-5 h-5" />
          </button>

          <a
            href={photo.downloadUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-black p-3 rounded-full hover:bg-gray-200"
          >
            <Download className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Tag */}
      {photo.tags?.[0]?.runner?.bibNumber && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          BIB {photo.tags[0].runner.bibNumber}
        </div>
      )}
    </div>
  );
}

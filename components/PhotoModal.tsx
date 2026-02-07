"use client";

import { X, Download } from "lucide-react";
import { Photo } from "./PhotoCard";

type Props = {
  photo: Photo | null;
  onClose: () => void;
};

export function PhotoModal({ photo, onClose }: Props) {
  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Image */}
      <img
        src={photo.photoUrl}
        alt="Race photo"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded"
      />

      {/* Actions */}
      <div className="absolute bottom-6 flex gap-3">
        <a
          href={photo.downloadUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
        >
          <Download className="w-5 h-5" />
          Tải xuống
        </a>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

interface PhotoCarouselProps {
  photos: string[];
  className?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1";
}

export function PhotoCarousel({
  photos,
  className = "",
  aspectRatio = "16/9",
}: PhotoCarouselProps) {
  const [current, setCurrent] = useState(0);

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? photos.length - 1 : c - 1));
  }, [photos.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c === photos.length - 1 ? 0 : c + 1));
  }, [photos.length]);

  if (!photos.length) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-xl bg-muted ${className}`}
        style={{ aspectRatio }}
      >
        <div className="text-center text-muted-foreground">
          <ImageIcon className="mx-auto h-10 w-10 mb-2" />
          <p className="text-sm">No photos</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      {/* Main Image */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-muted"
        style={{ aspectRatio }}
      >
        <Image
          src={photos[current]}
          alt={`Photo ${current + 1} of ${photos.length}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Navigation Arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Counter Badge */}
      {photos.length > 1 && (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white">
          {current + 1} / {photos.length}
        </span>
      )}

      {/* Dot Indicators */}
      {photos.length > 1 && photos.length <= 8 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current
                  ? "w-4 bg-white"
                  : "w-1.5 bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

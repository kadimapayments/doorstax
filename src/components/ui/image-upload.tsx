"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

interface ImageUploadProps {
  images: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  maxImages?: number;
  label?: string;
}

export function ImageUpload({
  images,
  onChange,
  folder = "uploads",
  maxImages = 10,
  label = "Photos",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    const newImages = [...images];

    for (const file of Array.from(files)) {
      if (newImages.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        break;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        newImages.push(data.url);
      } else {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    onChange(newImages);
    setUploading(false);
    e.target.value = "";
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <Image
                src={img}
                alt={`Photo ${i + 1}`}
                width={80}
                height={80}
                className="rounded-lg border border-border object-cover h-20 w-20"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
          disabled={uploading || images.length >= maxImages}
        >
          <span>
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Add Photos"}
          </span>
        </Button>
      </label>
    </div>
  );
}

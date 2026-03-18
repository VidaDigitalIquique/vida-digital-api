'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImageWithFallbackProps {
  src?: string | null;
  codigo: string;
  empresaSlug: string;
  alt?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function ImageWithFallback({ 
  src, 
  codigo, 
  empresaSlug, 
  alt, 
  fill = false,
  width,
  height,
  className 
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  // If no DB URL is provided and we haven't errored yet, try the predictable Cloudinary path
  const cloudinaryFallbackUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${empresaSlug}/${codigo}.jpeg`;
  const [imgSrc, setImgSrc] = useState(src || cloudinaryFallbackUrl);

  useEffect(() => {
    if (src) {
      setImgSrc(src);
      setError(false);
    }
  }, [src]);

  const handleError = () => {
    setError(true);
  };

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden ${className}`} style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}>
         <span className="text-sm font-mono text-zinc-400 dark:text-zinc-600 tracking-wider break-all px-2 text-center">{codigo}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}>
      <Image
        src={imgSrc}
        alt={alt || codigo}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className="object-cover"
        onError={handleError}
        unoptimized // We use pure URLs for Cloudinary direct sourcing if needed
      />
    </div>
  );
}

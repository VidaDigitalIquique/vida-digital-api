'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import flags from '@/config/feature-flags.json';

const FIX_D11 = flags['fix-d11-imagen-producto'] === true;

// ponytail: cache en memoria de sesión; se purga al recargar la app.
const fallidas = new Set<string>();
// Solo para tests: aísla el cache entre casos.
export function __resetFallidas() {
  fallidas.clear();
}

function addCloudinaryTransform(url: string | null | undefined): string {
  if (!url || !url.includes('res.cloudinary.com')) return url || '';
  return url.replace('/image/upload/', '/image/upload/q_auto,w_1200,c_limit/');
}

interface ImageWithFallbackProps {
  src?: string | null;
  codigo: string;
  empresaSlug?: string;
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
  className,
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  // Legacy (flag OFF): URL fabricada por convención de Cloudinary.
  const cloudinaryFallbackUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/q_auto,w_1200,c_limit/${empresaSlug}/${encodeURIComponent(codigo)}.jpeg`;
  const [imgSrc, setImgSrc] = useState(addCloudinaryTransform(src) || cloudinaryFallbackUrl);

  useEffect(() => {
    if (FIX_D11 || src) {
      setImgSrc(addCloudinaryTransform(src));
      setError(false);
    }
  }, [src]);

  const handleError = () => {
    if (FIX_D11 && imgSrc) fallidas.add(imgSrc);
    setError(true);
  };

  const sinImagen = FIX_D11 ? !imgSrc || error || fallidas.has(imgSrc) : error;

  if (sinImagen) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden ${className}`}
        style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}
      >
        <ImageOff className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
        <span className="text-sm font-mono text-zinc-400 dark:text-zinc-600 tracking-wider break-all px-2 text-center">
          {codigo}
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Sin imagen</span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}
    >
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

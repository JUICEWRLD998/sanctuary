import Image from "next/image";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Wrapper around Next.js Image with consistent defaults and loading states.
 * Ensures images are optimized and accessible.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
}: OptimizedImageProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="h-full w-full object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}

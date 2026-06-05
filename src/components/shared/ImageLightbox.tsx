import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  images?: { src: string; alt: string }[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

export function ImageLightbox({
  src,
  alt,
  isOpen,
  onClose,
  images,
  currentIndex = 0,
  onNavigate,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const hasMultiple = images && images.length > 1;

  // Reset zoom and position when image changes or lightbox opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple && onNavigate) {
        onNavigate((currentIndex - 1 + images.length) % images.length);
      }
      if (e.key === 'ArrowRight' && hasMultiple && onNavigate) {
        onNavigate((currentIndex + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, hasMultiple, images?.length, onNavigate, onClose]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newZoom = Math.min(Math.max(zoom + delta, 1), 4);
    setZoom(newZoom);
    // Reset position when zooming back to 1
    if (newZoom <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // Touch handlers for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches));
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      if (distance && lastTouchDistance) {
        const scale = distance / lastTouchDistance;
        const newZoom = Math.min(Math.max(zoom * scale, 1), 4);
        setZoom(newZoom);
        setLastTouchDistance(distance);
        // Reset position when zooming back to 1
        if (newZoom <= 1) {
          setPosition({ x: 0, y: 0 });
        }
      }
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDistance(null);
    setIsDragging(false);
  };

  // Mouse drag for panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double tap/click to zoom
  const handleDoubleClick = () => {
    if (zoom > 1) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  };

  if (!isOpen) return null;

  const currentImage = images ? images[currentIndex] : { src, alt };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Close button - prominent on mobile */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-4 right-4 z-[60] h-12 w-12 rounded-full bg-secondary/90 hover:bg-secondary text-foreground shadow-lg border border-border/50"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        <X className="w-7 h-7" />
      </Button>

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-secondary/80 px-3 py-1.5 rounded-full pointer-events-none">
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
        </div>
      )}

      {/* Navigation arrows */}
      {hasMultiple && onNavigate && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-secondary/80 hover:bg-secondary"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex - 1 + images.length) % images.length);
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-secondary/80 hover:bg-secondary"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex + 1) % images.length);
            }}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </>
      )}

      {/* Image counter */}
      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-secondary/80 px-4 py-2 rounded-full">
          <span className="text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      )}

      {/* Gesture hint on first view */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 text-muted-foreground text-xs opacity-60 pointer-events-none">
        Pinch or scroll to zoom • Double-tap to toggle
      </div>

      {/* Image container with gesture support */}
      <div 
        ref={imageRef}
        className={cn(
          "relative flex items-center justify-center overflow-hidden touch-none",
          isDragging ? "cursor-grabbing" : zoom > 1 ? "cursor-grab" : "cursor-zoom-in"
        )}
        style={{ width: '90vw', height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={currentImage.src}
          alt={currentImage.alt}
          className="rounded-lg shadow-2xl select-none pointer-events-none"
          draggable={false}
          style={{ 
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: 'center center',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        />
      </div>

      {/* Thumbnail strip for multiple images */}
      {hasMultiple && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 flex gap-2 p-2 bg-secondary/80 rounded-lg max-w-[80vw] overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.(idx);
              }}
              className={cn(
                "w-16 h-12 rounded overflow-hidden border-2 transition-all flex-shrink-0",
                idx === currentIndex 
                  ? "border-primary ring-2 ring-primary/50" 
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image as ImageIcon, Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageLightbox } from './ImageLightbox';

interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  maxImages?: number;
  className?: string;
}

export function MultiImageUpload({ 
  value = [], 
  onChange, 
  folder = 'general', 
  maxImages = 10,
  className 
}: MultiImageUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = (index: number) => {
    const container = carouselRef.current;
    if (!container) return;

    const el = container.querySelector(`[data-image-index="${index}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - value.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Maximum images reached',
        description: `You can only upload up to ${maxImages} images`,
        variant: 'destructive',
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    // Validate all files
    const invalidFiles: string[] = [];
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name} (invalid type)`);
      } else if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (too large)`);
      }
    }

    if (invalidFiles.length > 0) {
      toast({
        title: 'Some files could not be uploaded',
        description: `Issues: ${invalidFiles.join(', ')}. Please use images under 5MB.`,
        variant: 'destructive',
      });
      // Continue with valid files
    }

    const validFiles = filesToUpload.filter(file => 
      file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
    );

    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];
      
      // Upload all files concurrently
      const uploadPromises = validFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const results = await Promise.all(uploadPromises);
      uploadedUrls.push(...results);

      onChange([...value, ...uploadedUrls]);

      toast({
        title: 'Images uploaded',
        description: `${uploadedUrls.length} image(s) uploaded successfully`,
      });
    } catch (error) {
      devError('Error uploading images:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload one or more images. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    onChange(newUrls);
    // Adjust current index if needed
    if (currentIndex >= newUrls.length && newUrls.length > 0) {
      setCurrentIndex(newUrls.length - 1);
    }
  };

  const navigatePrev = () => {
    if (value.length <= 1) return;
    const nextIndex = (currentIndex - 1 + value.length) % value.length;
    setCurrentIndex(nextIndex);
    scrollToIndex(nextIndex);
  };

  const navigateNext = () => {
    if (value.length <= 1) return;
    const nextIndex = (currentIndex + 1) % value.length;
    setCurrentIndex(nextIndex);
    scrollToIndex(nextIndex);
  };

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const canAddMore = value.length < maxImages;

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />

      {/* Single Row Carousel with Navigation */}
      {value.length > 0 && (
        <div className="relative group">
          {/* Navigation Arrows */}
          {value.length > 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                onClick={navigatePrev}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                onClick={navigateNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Carousel Container */}
          <div 
            ref={carouselRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {value.map((url, index) => (
              <div 
                key={url}
                data-image-index={index}
                className={cn(
                  "relative flex-shrink-0 snap-start cursor-pointer group/item",
                  "w-32 h-24 sm:w-40 sm:h-28"
                )}
                onClick={() => openLightbox(index)}
              >
                <img
                  src={url}
                  alt={`Room image ${index + 1}`}
                  className={cn(
                    "w-full h-full object-cover rounded-lg border-2 transition-all",
                    index === 0 ? "border-primary" : "border-border",
                    "hover:border-primary/70 hover:shadow-md"
                  )}
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                    Main
                  </span>
                )}
                {/* Remove button on hover */}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}

            {/* Add More Button (inline) */}
            {canAddMore && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex-shrink-0 w-32 h-24 sm:w-40 sm:h-28 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed snap-start"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px]">Add more</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Dots indicator */}
          {value.length > 3 && (
            <div className="flex justify-center gap-1 mt-2">
                {value.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      index === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                    onClick={() => {
                      setCurrentIndex(index);
                      scrollToIndex(index);
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-28 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-6 h-6" />
              <span className="text-sm">Click to upload images</span>
              <span className="text-[10px]">Max {maxImages} images, 5MB each</span>
            </>
          )}
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">
        {value.length} / {maxImages} images • First image is the main display image • Click to enlarge
      </p>

      {/* Lightbox */}
      <ImageLightbox
        src={value[currentIndex] || ''}
        alt={`Room image ${currentIndex + 1}`}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={value.map((url, i) => ({ src: url, alt: `Room image ${i + 1}` }))}
        currentIndex={currentIndex}
        onNavigate={setCurrentIndex}
      />
    </div>
  );
}
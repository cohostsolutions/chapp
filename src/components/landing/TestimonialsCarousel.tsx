import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  avatar?: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Maria Santos',
    role: 'Owner',
    company: 'Café de Manila',
    content: 'May AI transformed our order taking. We went from missing 30% of inquiries to capturing every single one. Our pickup scheduling is now fully automated!',
    rating: 5,
  },
  {
    id: 2,
    name: 'James Chen',
    role: 'Sales Director',
    company: 'TechVentures PH',
    content: 'Jay qualifies our leads 24/7 while we sleep. Our conversion rate increased by 45% in the first month. The handoff to our sales team is seamless.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Ana Reyes',
    role: 'General Manager',
    company: 'Coastal Resort & Spa',
    content: 'Cece handles all our booking inquiries across Facebook and WhatsApp. Guest satisfaction scores are up 35% since implementation.',
    rating: 5,
  },
  {
    id: 4,
    name: 'Michael Torres',
    role: 'Founder',
    company: 'PropertyHub Manila',
    content: 'The multi-channel integration is a game changer. All our social messages now flow into one CRM with AI responses in under 2 seconds.',
    rating: 5,
  },
  {
    id: 5,
    name: 'Sarah Lim',
    role: 'Operations Head',
    company: 'FoodPanda Partner',
    content: 'We process 3x more orders daily with May AI. The Taglish support means our customers feel truly understood.',
    rating: 5,
  },
];

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  return (
    <section className="py-24 bg-card/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Trusted by Businesses Across Industries
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how companies are transforming their customer engagement with AlCor Nexus.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Main Testimonial Card */}
          <div 
            className="relative overflow-hidden rounded-3xl bg-card border border-border/50 p-8 md:p-12"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            <Quote className="absolute top-6 left-6 w-12 h-12 text-primary/10" />
            
            <div className="relative z-10">
              {testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.id}
                  className={cn(
                    'transition-all duration-500',
                    index === currentIndex
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 absolute inset-0 translate-x-8'
                  )}
                  style={{ display: index === currentIndex ? 'block' : 'none' }}
                >
                  {/* Rating */}
                  <div className="flex gap-1 mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>

                  {/* Content */}
                  <blockquote className="text-xl md:text-2xl font-medium text-foreground mb-8 leading-relaxed">
                    "{testimonial.content}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
              <Button
                variant="ghost"
                size="icon"
                className="pointer-events-auto rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-lg"
                onClick={goToPrevious}
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="pointer-events-auto rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-lg"
                onClick={goToNext}
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Dots Indicator - min 24px touch targets */}
          <div className="flex justify-center gap-3 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  'min-w-6 min-h-6 p-1.5 flex items-center justify-center rounded-full transition-all duration-300',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background'
                )}
                aria-label={`Go to testimonial ${index + 1}`}
              >
                <span className={cn(
                  'block rounded-full transition-all duration-300',
                  index === currentIndex
                    ? 'w-6 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { trackFormSubmission, trackButtonClick } from '@/hooks/useAnalyticsTracking';
import { cn } from '@/lib/utils';
import { devLog } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Bot, Utensils, Hotel, Loader2, CheckCircle2, Calendar as CalendarIcon, Clock, Sparkles, Globe, Mail } from 'lucide-react';
import { toast } from 'sonner';

// Common timezones with their UTC offsets
const timezones = [
  { value: 'Asia/Manila', label: 'Philippine Time (PHT)', offset: '+8:00' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-5:00' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: '-6:00' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: '-7:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-8:00' },
  { value: 'Europe/London', label: 'London (GMT)', offset: '+0:00' },
  { value: 'Europe/Paris', label: 'Central European (CET)', offset: '+1:00' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+4:00' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+8:00' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)', offset: '+9:00' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: '+11:00' },
];

const formSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Please enter a valid email').max(255, 'Email must be less than 255 characters'),
  phone: z.string().trim().max(20, 'Phone must be less than 20 characters').optional().or(z.literal('')),
  company_name: z.string().trim().max(100, 'Company name must be less than 100 characters').optional().or(z.literal('')),
  business_type: z.enum(['sales', 'food', 'hospitality', 'other'], { required_error: 'Please select your business type' }),
  custom_requirements: z.string().trim().max(1000, 'Custom requirements must be less than 1000 characters').optional().or(z.literal('')),
  message: z.string().trim().max(500, 'Message must be less than 500 characters').optional().or(z.literal('')),
  scheduled_date: z.date().optional(),
  scheduled_time: z.string().optional(),
}).refine((data) => {
  if (data.business_type === 'other') {
    return data.custom_requirements && data.custom_requirements.trim().length >= 10;
  }
  return true;
}, {
  message: 'Please describe your custom AI agent needs (at least 10 characters)',
  path: ['custom_requirements'],
});

type FormData = z.infer<typeof formSchema>;

const businessTypes = [
  { value: 'sales', label: 'Sales & Lead Generation', icon: Bot, description: 'Real estate, insurance, consulting' },
  { value: 'food', label: 'Food & Restaurant', icon: Utensils, description: 'Restaurants, cafes, food delivery' },
  { value: 'hospitality', label: 'Hotels & Hospitality', icon: Hotel, description: 'Hotels, Airbnb, resorts' },
  { value: 'other', label: 'Others (Custom AI Agent)', icon: Sparkles, description: 'We can build an AI agent for you' },
];

export interface LeadCapturePrefilledAgent {
  type: 'jay' | 'may' | 'cece';
  name: string;
  role: string;
}

const agentBusinessTypeMap: Record<LeadCapturePrefilledAgent['type'], FormData['business_type']> = {
  jay: 'sales',
  may: 'food',
  cece: 'hospitality',
};

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledIndustry?: string | null;
  prefilledAgent?: LeadCapturePrefilledAgent | null;
}

export function LeadCaptureDialog({ open, onOpenChange, prefilledIndustry, prefilledAgent }: LeadCaptureDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<'form' | 'schedule'>('form');
  const [contactedViaEmail, setContactedViaEmail] = useState(false);
  const [skippedBooking, setSkippedBooking] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [demoRequestId, setDemoRequestId] = useState<string | null>(null);
  
  // Auto-detect user's timezone from browser
  const [selectedTimezone, setSelectedTimezone] = useState(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Check if browser timezone is in our list
      const matchedTz = timezones.find(tz => tz.value === browserTz);
      return matchedTz ? browserTz : 'Asia/Manila';
    } catch {
      return 'Asia/Manila';
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company_name: '',
      business_type: undefined,
      custom_requirements: '',
      message: '',
      scheduled_date: undefined,
      scheduled_time: undefined,
    },
  });

  const selectedBusinessType = form.watch('business_type');

  const selectedDate = form.watch('scheduled_date');

  // Track when dialog opens (Get Started button click)
  useEffect(() => {
    if (open) {
      trackButtonClick('Get Started', { page: window.location.pathname });
    }
  }, [open]);

  // PHASE 3: Handle structured agent or custom industry prefills when the dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    if (prefilledAgent) {
      form.setValue('business_type', agentBusinessTypeMap[prefilledAgent.type]);
      form.setValue('custom_requirements', '');
      form.setValue('message', `Interested in ${prefilledAgent.name} (${prefilledAgent.role}) AI agent.`);
      return;
    }

    if (prefilledIndustry) {
      form.setValue('business_type', 'other');
      form.setValue('custom_requirements', `Interested in ${prefilledIndustry} AI agent solution`);
      form.setValue('message', '');
    }
  }, [open, prefilledIndustry, prefilledAgent, form]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (selectedDate && step === 'schedule') {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, step]);

  const fetchAvailableSlots = async (date: Date) => {
    setLoadingSlots(true);
    try {
      devLog('Fetching available slots for:', date.toISOString());
      const { data, error } = await supabase.functions.invoke('book-demo', {
        body: { action: 'get_available_slots', date: date.toISOString() },
      });

      devLog('Slots response:', data, error);

      if (error) throw error;
      
      if (data.slots && data.slots.length > 0) {
        setAvailableSlots(data.slots);
      } else {
        // Generate fallback slots if no slots returned
        devLog('No slots from calendar, generating fallback slots');
        generateFallbackSlots(date);
      }
    } catch (error) {
      devLog('Error fetching slots:', error);
      generateFallbackSlots(date);
    } finally {
      setLoadingSlots(false);
    }
  };

  const generateFallbackSlots = (date: Date) => {
    const fallbackSlots: string[] = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotDate = new Date(date);
        slotDate.setHours(hour, minute, 0, 0);
        if (slotDate > new Date()) {
          fallbackSlots.push(slotDate.toISOString());
        }
      }
    }
    setAvailableSlots(fallbackSlots);
  };

  const onSubmitForm = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Combine custom requirements with message for 'other' business type
      const combinedMessage = data.business_type === 'other' 
        ? `[Custom AI Agent Requirements]\n${data.custom_requirements || 'Not specified'}\n\n[Additional Notes]\n${data.message || 'None'}`
        : data.message || null;

      // Submit via edge function to bypass RLS
      const { data: result, error } = await supabase.functions.invoke('book-demo', {
        body: {
          action: 'submit_lead',
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          company_name: data.company_name || null,
          business_type: data.business_type,
          message: combinedMessage,
        },
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Failed to submit');

      setDemoRequestId(result.id);
      
      // Track form submission
      trackFormSubmission('Lead Capture', { business_type: data.business_type });
      
      toast.success('Great! Now let\'s schedule your call.');
      setStep('schedule');
      
      // Pre-select tomorrow's date to trigger slot fetching
      const tomorrow = addDays(new Date(), 1);
      // Skip weekends
      const nextWeekday = tomorrow.getDay() === 0 ? addDays(tomorrow, 1) : 
                          tomorrow.getDay() === 6 ? addDays(tomorrow, 2) : tomorrow;
      form.setValue('scheduled_date', nextWeekday);
    } catch (error: unknown) {
      devError('Error submitting form:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onScheduleCall = async () => {
    const data = form.getValues();
    devLog('Schedule call data:', data);
    
    if (!data.scheduled_date || !data.scheduled_time) {
      toast.error('Please select a date and time');
      return;
    }

    setIsSubmitting(true);
    try {
      devLog('Invoking book-demo with:', {
        action: 'book_demo',
        demoRequestId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        company: data.company_name || null,
        businessType: data.business_type,
        scheduledTime: data.scheduled_time,
        message: data.message || null,
      });
      
      const { data: bookingResult, error } = await supabase.functions.invoke('book-demo', {
        body: {
          action: 'book_demo',
          demoRequestId,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          company: data.company_name || null,
          businessType: data.business_type,
          scheduledTime: data.scheduled_time,
          message: data.message || null,
        },
      });

      devLog('Book demo response:', bookingResult, error);

      if (error) {
        devLog('Supabase function error:', error);
        throw error;
      }

      if (!bookingResult?.success) {
        throw new Error(bookingResult?.error || 'Failed to schedule call');
      }

      // Track successful booking
      trackButtonClick('Demo Call Booked', { 
        business_type: data.business_type,
        scheduled_time: data.scheduled_time 
      });

      setSkippedBooking(false);
      setIsSuccess(true);
      form.reset();
    } catch (error: unknown) {
      devError('Error scheduling call:', error);
      const message = error instanceof Error ? error.message : 'Failed to schedule call. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipScheduling = async () => {
    const data = form.getValues();
    
    // Track skip action
    trackButtonClick('Demo Booking Skipped', { 
      business_type: data.business_type 
    });

    // Update demo request status to 'skipped' in database
    if (demoRequestId) {
      try {
        await supabase.functions.invoke('book-demo', {
          body: {
            action: 'skip_booking',
            demoRequestId,
          },
        });
      } catch (error) {
        devError('Error updating skip status:', error);
      }
    }

    setSkippedBooking(true);
    setIsSuccess(true);
    form.reset();
  };

  const onContactUs = async (data: FormData) => {
    setIsContactSubmitting(true);
    try {
      // Combine custom requirements with message for 'other' business type
      const combinedMessage = data.business_type === 'other' 
        ? `[Custom AI Agent Requirements]\n${data.custom_requirements || 'Not specified'}\n\n[Additional Notes]\n${data.message || 'None'}`
        : data.message || null;

      // Submit lead via edge function
      const { data: result, error } = await supabase.functions.invoke('book-demo', {
        body: {
          action: 'contact_us',
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          company_name: data.company_name || null,
          business_type: data.business_type,
          message: combinedMessage,
        },
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Failed to submit');

      // Track form submission
      trackFormSubmission('Contact Us', { business_type: data.business_type });
      
      setContactedViaEmail(true);
      setIsSuccess(true);
      form.reset();
    } catch (error: unknown) {
      devError('Error submitting contact form:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(message);
    } finally {
      setIsContactSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setIsSuccess(false);
      setStep('form');
      setSkippedBooking(false);
      setContactedViaEmail(false);
      setDemoRequestId(null);
      setAvailableSlots([]);
    }, 300);
  };

  // Get next 14 days for date selection
  const minDate = new Date();
  const maxDate = addDays(new Date(), 14);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl">Thank You!</DialogTitle>
              <DialogDescription className="text-base mt-2">
                {contactedViaEmail
                  ? "We've received your message! Our team will respond to your email within 24 hours."
                  : skippedBooking 
                    ? "We've received your information! Our team will reach out to you via email within 24 hours to discuss your needs."
                    : "Your demo call has been scheduled! You'll receive a calendar invite and confirmation email shortly."}
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-6" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : step === 'form' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary mb-2">
                <CalendarIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Schedule a Demo</span>
              </div>
              <DialogTitle className="text-2xl">Let's Talk About Your Business</DialogTitle>
              <DialogDescription>
                Fill out the form below and schedule a personalized demo call.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 201 555 0123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="business_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {businessTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="w-4 h-4" />
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedBusinessType === 'other' && (
                  <FormField
                    control={form.control}
                    name="custom_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Describe your custom AI agent needs *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us about your business and what kind of AI agent you need. E.g., 'I run a dental clinic and need an AI to handle appointment scheduling and patient inquiries.'" 
                            className="resize-none"
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{selectedBusinessType === 'other' ? 'Additional notes (optional)' : 'Tell us about your needs'}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={selectedBusinessType === 'other' ? 'Any additional information you\'d like to share...' : 'What challenges are you facing with customer engagement?'} 
                          className="resize-none"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="flex-1" size="lg" disabled={isSubmitting || isContactSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Schedule Call
                        <CalendarIcon className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1" 
                    size="lg" 
                    disabled={isSubmitting || isContactSubmitting}
                    onClick={form.handleSubmit(onContactUs)}
                  >
                    {isContactSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Contact Us
                        <Mail className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Pick a Time</span>
              </div>
              <DialogTitle className="text-2xl">Schedule Your Demo Call</DialogTitle>
              <DialogDescription>
                Choose a convenient time for a 30-minute demo call.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <div className="space-y-4 mt-4">
                {/* Timezone Picker */}
                <div className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Your Timezone
                  </FormLabel>
                  <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          <span className="flex items-center gap-2">
                            <span>{tz.label}</span>
                            <span className="text-muted-foreground text-xs">UTC{tz.offset}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "EEEE, MMMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            form.setValue('scheduled_time', undefined);
                          }}
                          disabled={(date) => 
                            date < minDate || 
                            date > maxDate || 
                            date.getDay() === 0 || 
                            date.getDay() === 6
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedDate && (
                <div className="space-y-2">
                  <FormLabel>Select Time</FormLabel>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No available slots for this date. Please select another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                      {availableSlots.map((slot) => {
                        const slotDate = new Date(slot);
                        const isSelected = form.watch('scheduled_time') === slot;
                        // Format time in user's selected timezone
                        const formattedTime = slotDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: selectedTimezone,
                        });
                        return (
                          <Button
                            key={slot}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => form.setValue('scheduled_time', slot)}
                            className="text-sm"
                          >
                            {formattedTime}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 space-y-3">
                <Button
                  type="button"
                  className="w-full"
                  onClick={onScheduleCall}
                  disabled={isSubmitting || !form.watch('scheduled_time')}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Book Call
                    </>
                  )}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={skipScheduling}
                  disabled={isSubmitting}
                >
                  Skip & Just Email Me
                </Button>
              </div>
              </div>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

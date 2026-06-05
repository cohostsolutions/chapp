import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { devError } from '@/lib/logger';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { useBookingNotes } from '@/hooks/useBookingNotes';
import { useBookingTemplates } from '@/hooks/useBookingTemplates';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useRoomCapacityValidation } from '@/hooks/useRoomCapacityValidation';
import { BookingWithRelations, Property, RoomUnit } from '@/hooks/useAccommodationData';
import { calculateBookingPrice, calculateDynamicPricing, getPropertyPricingContext } from '@/lib/bookingPricing';
import { getAccommodationWritePropertyId } from '@/lib/accommodationPropertySelection';
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { usePricingMarketProfiles } from '@/hooks/usePricingMarketProfiles';
import { DynamicPricingSuggestionComponent } from './DynamicPricingSuggestion';
import { RoomCapacityAlert } from './RoomCapacityAlert';
import { Calendar, BedDouble, FileText, Loader2, Plus, Save } from 'lucide-react';

export interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomUnit[];
  bookings: BookingWithRelations[];
  properties: Property[];
  selectedPropertyId: string;
  requiresPropertySelection: boolean;
  formatCurrency: (amount: number) => string;
  checkBookingOverlap: (roomId: string, checkIn: string, checkOut: string) => boolean;
  syncBooking: (bookingId: string) => Promise<{ success?: boolean }>;
  deleteCalendarEvent: (bookingId: string) => Promise<unknown>;
  prefilledBooking?: Partial<CreateBookingDraft> | null;
  onSuccess?: () => void;
}

export interface CreateBookingDraft {
  roomId: string;
  checkIn: Date | null;
  checkOut: Date | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestCount: number;
  notes: string;
  bookingSource: string;
}

const defaultBookingDraft = (): CreateBookingDraft => ({
  roomId: '',
  checkIn: null,
  checkOut: null,
  guestName: '',
  guestPhone: '',
  guestEmail: '',
  guestCount: 1,
  notes: '',
  bookingSource: '',
});

export function CreateBookingDialog({
  open,
  onOpenChange,
  rooms,
  bookings,
  properties,
  selectedPropertyId,
  requiresPropertySelection,
  formatCurrency,
  checkBookingOverlap,
  syncBooking,
  deleteCalendarEvent,
  prefilledBooking,
  onSuccess,
}: CreateBookingDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { execute: executeUndoable } = useUndoableAction();
  const noteHistory = useBookingNotes();
  const bookingTemplates = useBookingTemplates();
  const { validateGuestCount } = useRoomCapacityValidation();
  const { defaultCountryCode, phonePlaceholder } = useOrganizationPhone();
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [draft, setDraft] = useState<CreateBookingDraft>(defaultBookingDraft);
  const wasOpenRef = useRef(false);
  const { activeProfiles } = usePricingMarketProfiles();

  const resetDraft = useCallback(() => {
    setDraft(defaultBookingDraft());
    setTemplateName('');
    setSelectedTemplateId('');
    setSaveTemplateDialogOpen(false);
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft({
        ...defaultBookingDraft(),
        ...prefilledBooking,
      });
      setSelectedTemplateId('');
      setSaveTemplateDialogOpen(false);
      setTemplateName('');
    }

    if (!open && wasOpenRef.current) {
      resetDraft();
    }

    wasOpenRef.current = open;
  }, [open, prefilledBooking, resetDraft]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === draft.roomId),
    [rooms, draft.roomId]
  );

  const defaultWritePropertyId = useMemo(
    () => getAccommodationWritePropertyId(selectedPropertyId, properties),
    [selectedPropertyId, properties]
  );

  const canResolvePropertyForDraft = !!(selectedRoom?.property_id || defaultWritePropertyId);

  const selectedProperty = useMemo(() => {
    if (selectedRoom?.property_id) {
      return properties.find((property) => property.id === selectedRoom.property_id) || null;
    }

    if (selectedPropertyId !== 'all') {
      return properties.find((property) => property.id === selectedPropertyId) || null;
    }

    return null;
  }, [properties, selectedPropertyId, selectedRoom?.property_id]);

  const pricingLocationContext = useMemo(
    () => getPropertyPricingContext(selectedProperty ? {
      propertyName: selectedProperty.name,
      propertyDescription: selectedProperty.description,
      addressLine1: selectedProperty.address_line_1,
      city: selectedProperty.city,
      state: selectedProperty.state,
      region: selectedProperty.region,
      country: selectedProperty.country,
      postalCode: selectedProperty.postal_code,
    } : null, {
      country: selectedRoom?.pricing_country,
      region: selectedRoom?.pricing_region,
      city: selectedRoom?.pricing_city,
      district: selectedRoom?.pricing_district,
    }),
    [selectedProperty, selectedRoom?.pricing_city, selectedRoom?.pricing_country, selectedRoom?.pricing_district, selectedRoom?.pricing_region]
  );

  const sourceOptions = useMemo(() => {
    const calendarSources = selectedRoom?.calendar_sources as Record<string, string> | null | undefined;
    return calendarSources
      ? [...new Set(Object.values(calendarSources))].filter((source) => source && source.trim() !== '')
      : [];
  }, [selectedRoom?.calendar_sources]);

  const dynamicPricing = useMemo(() => {
    if (!selectedRoom || !draft.checkIn || !draft.checkOut || !draft.guestCount) {
      return null;
    }

    return calculateDynamicPricing(
      format(draft.checkIn, 'yyyy-MM-dd'),
      format(draft.checkOut, 'yyyy-MM-dd'),
      draft.guestCount,
      selectedRoom,
      bookings,
      rooms.filter((room) => room.is_active).length,
      pricingLocationContext,
      activeProfiles.map((profile) => ({
        scope: profile.scope,
        country: profile.country,
        region: profile.region,
        city: profile.city,
        district: profile.district,
        multiplier: profile.multiplier,
        marketPositioning: profile.market_positioning,
        adjustmentLabel: profile.adjustment_label,
        isActive: profile.is_active,
        displayOrder: profile.display_order,
      }))
    );
  }, [selectedRoom, draft.checkIn, draft.checkOut, draft.guestCount, bookings, rooms, pricingLocationContext, activeProfiles]);

  const validateDraft = useCallback(() => {
    if (!draft.roomId) {
      toast({
        title: 'Missing Room',
        description: 'Please select a room.',
        variant: 'destructive',
      });
      return false;
    }

    if (!draft.guestName.trim()) {
      toast({
        title: 'Missing Guest Name',
        description: 'Please enter the guest name.',
        variant: 'destructive',
      });
      return false;
    }

    if (!draft.checkIn || !draft.checkOut) {
      toast({
        title: 'Missing Dates',
        description: 'Please select check-in and check-out dates.',
        variant: 'destructive',
      });
      return false;
    }

    if (draft.checkIn >= draft.checkOut) {
      toast({
        title: 'Invalid Dates',
        description: 'Check-out date must be after check-in date.',
        variant: 'destructive',
      });
      return false;
    }

    if (draft.guestCount < 1) {
      toast({
        title: 'Invalid Guest Count',
        description: 'Guest count must be at least 1.',
        variant: 'destructive',
      });
      return false;
    }

    if (selectedRoom?.capacity) {
      const validation = validateGuestCount(draft.guestCount, selectedRoom.capacity);
      if (!validation.isValid) {
        return false;
      }
    }

    return true;
  }, [draft, selectedRoom?.capacity, toast, validateGuestCount]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      toast({
        title: 'Missing Name',
        description: 'Please enter a name for the template',
        variant: 'destructive',
      });
      return;
    }

    await bookingTemplates.saveTemplate(
      templateName,
      {
        guestName: draft.guestName,
        guestEmail: draft.guestEmail,
        guestPhone: draft.guestPhone,
        guestCount: draft.guestCount,
        notes: draft.notes,
        bookingSource: draft.bookingSource,
      },
      draft.roomId || null
    );

    setSaveTemplateDialogOpen(false);
    setTemplateName('');
  }, [bookingTemplates, draft, templateName, toast]);

  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = bookingTemplates.templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setDraft((current) => ({
      ...current,
      roomId: template.room_id || current.roomId,
      guestName: template.template_data.guestName || '',
      guestEmail: template.template_data.guestEmail || '',
      guestPhone: template.template_data.guestPhone || '',
      guestCount: template.template_data.guestCount || 1,
      notes: template.template_data.notes || '',
      bookingSource: template.template_data.bookingSource || '',
    }));

    toast({
      title: 'Template Loaded',
      description: `Applied "${template.name}" template`,
    });
  }, [bookingTemplates.templates, toast]);

  const handleCreateBooking = useCallback(async () => {
    if (!validateDraft()) {
      return;
    }

    const checkInStr = format(draft.checkIn!, 'yyyy-MM-dd');
    const checkOutStr = format(draft.checkOut!, 'yyyy-MM-dd');

    if (checkBookingOverlap(draft.roomId, checkInStr, checkOutStr)) {
      toast({
        title: 'Room Not Available',
        description: 'This room has a booking that conflicts with the selected dates.',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Organization not found.',
        variant: 'destructive',
      });
      return;
    }

    const writePropertyId = selectedRoom?.property_id || defaultWritePropertyId;
    if (!writePropertyId) {
      toast({
        title: 'Select a property',
        description: 'Choose a specific property before creating a booking.',
        variant: 'destructive',
      });
      return;
    }

    const guestName = draft.guestName.trim();
    const guestEmail = draft.guestEmail.trim();
    const hasPhone = draft.guestPhone.trim().length > 0;
    const hasEmail = guestEmail.length > 0;

    if (!hasPhone && !hasEmail) {
      toast({
        title: 'Contact required',
        description: 'Enter at least a phone number or email before creating a booking.',
        variant: 'destructive',
      });
      return;
    }

    if (hasEmail && !/^\S+@\S+\.\S+$/.test(guestEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedGuestPhone = draft.guestPhone.trim()
      ? normalizePhoneNumber(draft.guestPhone, defaultCountryCode)
      : null;

    if (normalizedGuestPhone && !isValidPhoneNumber(normalizedGuestPhone, defaultCountryCode)) {
      toast({
        title: 'Invalid Phone Number',
        description: getPhoneValidationMessage(defaultCountryCode),
        variant: 'destructive',
      });
      return;
    }

    setCreatingBooking(true);

    let createdLeadId: string | null = null;
    let createdBookingId: string | null = null;

    try {
      await executeUndoable({
        action: async () => {
          const { data: lead, error: leadError } = await supabase
            .from('leads')
            .insert({
              organization_id: profile.organization_id,
              name: guestName,
              phone: normalizedGuestPhone,
              email: guestEmail || null,
              source: 'manual',
              status: 'new',
            })
            .select()
            .single();

          if (leadError) throw leadError;
          createdLeadId = lead.id;

          const totalPrice = selectedRoom
            ? calculateBookingPrice(checkInStr, checkOutStr, draft.guestCount, selectedRoom)
            : null;

          const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
              organization_id: profile.organization_id,
              room_unit_id: draft.roomId,
              lead_id: lead.id,
              check_in: checkInStr,
              check_out: checkOutStr,
              guest_count: draft.guestCount,
              notes: draft.notes || null,
              status: 'pending',
              booking_source: draft.bookingSource || null,
              total_price: totalPrice,
              property_id: writePropertyId,
            })
            .select()
            .single();

          if (bookingError) throw bookingError;
          createdBookingId = booking.id;

          if (booking.id) {
            syncBooking(booking.id)
              .then((result) => {
                if (!result?.success) {
                  toast({
                    title: 'Calendar Sync Failed',
                    description: 'Booking was created, but calendar sync failed. You can retry from booking details.',
                    variant: 'default',
                  });
                }
              })
              .catch((error) => {
                devError('Calendar sync error:', error);
                toast({
                  title: 'Calendar Sync Failed',
                  description: 'Booking was created, but calendar sync encountered an error.',
                  variant: 'default',
                });
              });
          }

          return { leadId: lead.id, bookingId: booking.id };
        },
        undoAction: async () => {
          if (createdBookingId) {
            await deleteCalendarEvent(createdBookingId);
            await supabase.from('bookings').delete().eq('id', createdBookingId);
          }

          if (createdLeadId) {
            await supabase.from('leads').delete().eq('id', createdLeadId);
          }
        },
        successMessage: 'Booking Created',
        successDescription: `Reservation for ${guestName} has been created`,
        duration: 10000,
        onSuccess: async (result) => {
          if (draft.notes && result?.bookingId) {
            try {
              await noteHistory.addNoteHistory(
                result.bookingId,
                draft.notes,
                profile?.full_name || profile?.email
              );
            } catch (error) {
              devError('Failed to save note history:', error);
            }
          }

          onOpenChange(false);
          onSuccess?.();
        },
      });
    } finally {
      setCreatingBooking(false);
    }
  }, [canResolvePropertyForDraft, checkBookingOverlap, defaultCountryCode, defaultWritePropertyId, deleteCalendarEvent, draft, executeUndoable, noteHistory, onOpenChange, onSuccess, profile, selectedRoom, syncBooking, toast, validateDraft]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              New Booking
            </DialogTitle>
            <DialogDescription>
              Create a manual booking for a guest
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {requiresPropertySelection && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
                Select a specific property before creating a manual booking.
              </div>
            )}

            {!requiresPropertySelection && !canResolvePropertyForDraft && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Property context is not ready yet. Select a property and room, then try again.
              </div>
            )}

            {bookingTemplates.templates.length > 0 && (
              <div className="space-y-2 pb-3 border-b">
                <Label className="text-xs text-muted-foreground">Quick Start</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(value) => {
                      setSelectedTemplateId(value);
                      handleLoadTemplate(value);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <FileText className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Load template..." />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      {bookingTemplates.templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveTemplateDialogOpen(true)}
                    disabled={!draft.guestName.trim()}
                    title="Save current booking as template"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Room *</Label>
              <Select
                value={draft.roomId}
                onValueChange={(value) => setDraft((current) => ({ ...current, roomId: value, bookingSource: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {rooms.filter((room) => room.is_active).map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      <div className="flex items-center gap-2">
                        <BedDouble className="w-4 h-4" />
                        {room.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Guest Name *</Label>
              <Input
                value={draft.guestName}
                onChange={(event) => setDraft((current) => ({ ...current, guestName: event.target.value }))}
                placeholder="Enter guest name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={draft.guestPhone}
                  onChange={(event) => setDraft((current) => ({ ...current, guestPhone: event.target.value }))}
                  placeholder={phonePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={draft.guestEmail}
                  onChange={(event) => setDraft((current) => ({ ...current, guestEmail: event.target.value }))}
                  placeholder="guest@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Check-in *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                      <Calendar className="mr-2 h-4 w-4" />
                      {draft.checkIn ? format(draft.checkIn, 'MMM d') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]">
                    <CalendarPicker
                      mode="single"
                      selected={draft.checkIn || undefined}
                      onSelect={(date) => date && setDraft((current) => ({
                        ...current,
                        checkIn: date,
                        checkOut: current.checkOut && current.checkOut <= date ? addDays(date, 1) : current.checkOut,
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Check-out *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                      <Calendar className="mr-2 h-4 w-4" />
                      {draft.checkOut ? format(draft.checkOut, 'MMM d') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]">
                    <CalendarPicker
                      mode="single"
                      selected={draft.checkOut || undefined}
                      onSelect={(date) => date && setDraft((current) => ({ ...current, checkOut: date }))}
                      disabled={(date) => (draft.checkIn ? date <= draft.checkIn : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Number of Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.guestCount}
                  onChange={(event) => setDraft((current) => ({ ...current, guestCount: parseInt(event.target.value, 10) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Booking Source</Label>
                <Select
                  value={draft.bookingSource || '_none'}
                  onValueChange={(value) => setDraft((current) => ({ ...current, bookingSource: value === '_none' ? '' : value }))}
                  disabled={!draft.roomId}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={draft.roomId ? 'Select source' : 'Select room first'} />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="_none">Not specified</SelectItem>
                    {sourceOptions.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <RoomCapacityAlert
              guestCount={draft.guestCount}
              roomCapacity={selectedRoom?.capacity ?? undefined}
              roomName={selectedRoom?.name}
            />

            {dynamicPricing && (
              <DynamicPricingSuggestionComponent
                suggestion={dynamicPricing}
                formatCurrency={formatCurrency}
              />
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Add booking notes..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBooking} disabled={creatingBooking || requiresPropertySelection || !canResolvePropertyForDraft}>
              {creatingBooking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Save Booking Template</DialogTitle>
            <DialogDescription>
              Save this booking setup so your team can reuse it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="e.g. Weekend walk-in"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={bookingTemplates.isSaving || !templateName.trim()}>
              {bookingTemplates.isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

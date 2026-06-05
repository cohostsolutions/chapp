import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BedDouble, 
  Plus, 
  Search, 
  Users,
  Edit,
  Trash2,
  Loader2,
  CalendarCheck,
  AlertCircle,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { LocationPickerFields } from '@/components/shared/LocationPickerFields';
import { DraggableGrid } from '@/components/shared/DraggableGrid';
import { MultiImageUpload } from '@/components/shared/MultiImageUpload';
import { CalendarSelector } from '@/components/rooms/CalendarSelector';
import { useAccommodationData, RoomUnit, PricingTier, StayDiscount } from '@/hooks/useAccommodationData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { Json } from '@/integrations/supabase/types';
import {
  getPricingLocationLabel,
} from '@/lib/pricingLocationCatalog';
import { RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

interface RoomsTabContentProps {
  accommodationData: ReturnType<typeof useAccommodationData>;
  formatCurrency: (amount: number) => string;
}

export default function RoomsTabContent({
  accommodationData,
  formatCurrency,
}: RoomsTabContentProps) {
  const { toast } = useToast();
  const { execute: executeUndoable } = useUndoableAction();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomUnit | null>(null);
  const [saving, setSaving] = useState(false);
  const [createPropertyId, setCreatePropertyId] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price_per_night: '',
    pricing_country: '',
    pricing_region: '',
    pricing_city: '',
    pricing_district: '',
    is_active: true,
    calendar_ids: [] as string[],
    calendar_sources: {} as Record<string, string>,
    amenities: [] as string[],
    image_urls: [] as string[],
    pricing_tiers: [] as PricingTier[],
    stay_discounts: [] as StayDiscount[],
  });
  const [initialCalendarData, setInitialCalendarData] = useState({
    calendar_ids: [] as string[],
    calendar_sources: {} as Record<string, string>,
  });

  const {
    rooms,
    stats,
    isLoading,
    refetchAll,
    selectedPropertyId,
    properties,
  } = accommodationData;

  const selectedProperty = useMemo(() => {
    if (selectedPropertyId !== 'all') {
      return properties.find((property) => property.id === selectedPropertyId) || null;
    }

    return properties.length === 1 ? properties[0] : null;
  }, [properties, selectedPropertyId]);

  const getDefaultLocationFormState = () => ({
    pricing_country: selectedProperty?.country || '',
    pricing_region: selectedProperty?.region || selectedProperty?.state || '',
    pricing_city: selectedProperty?.city || '',
    pricing_district: '',
  });

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.pricing_country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.pricing_region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.pricing_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.pricing_district?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || room.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [rooms, searchTerm, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(rooms.map(r => r.category).filter(Boolean) as string[])];
    return ['all', ...uniqueCategories];
  }, [rooms]);

  const createRoomPropertyId = useMemo(() => {
    if (createPropertyId && properties.some((property) => property.id === createPropertyId)) {
      return createPropertyId;
    }

    if (selectedPropertyId !== 'all') {
      return properties.some((property) => property.id === selectedPropertyId) ? selectedPropertyId : '';
    }

    return properties[0]?.id || '';
  }, [createPropertyId, properties, selectedPropertyId]);
  const canCreateRoom = properties.length > 0;

  useEffect(() => {
    if (!dialogOpen || editingRoom) {
      return;
    }

    setFormData((current) => {
      if (current.pricing_country || current.pricing_region || current.pricing_city || current.pricing_district) {
        return current;
      }

      return {
        ...current,
        ...getDefaultLocationFormState(),
      };
    });
  }, [dialogOpen, editingRoom, selectedProperty?.city, selectedProperty?.country, selectedProperty?.region, selectedProperty?.state]);

  const resetForm = () => {
    const defaultCreatePropertyId = selectedPropertyId !== 'all'
      ? (properties.some((property) => property.id === selectedPropertyId) ? selectedPropertyId : properties[0]?.id || '')
      : (properties[0]?.id || '');

    setFormData({
      name: '',
      category: '',
      description: '',
      price_per_night: '',
      ...getDefaultLocationFormState(),
      is_active: true,
      calendar_ids: [],
      calendar_sources: {},
      amenities: [],
      image_urls: [],
      pricing_tiers: [],
      stay_discounts: [],
    });
    setCreatePropertyId(defaultCreatePropertyId);
    setEditingRoom(null);
  };

  const openEditDialog = (room: RoomUnit) => {
    setEditingRoom(room);
    const calendarIds = Array.isArray(room.calendar_ids) ? room.calendar_ids : [];
    const calendarSources = (room.calendar_sources as Record<string, string>) || {};
    setFormData({
      name: room.name,
      category: room.category || '',
      description: room.description || '',
      price_per_night: room.price_per_night != null ? String(room.price_per_night) : '',
      pricing_country: room.pricing_country || '',
      pricing_region: room.pricing_region || '',
      pricing_city: room.pricing_city || '',
      pricing_district: room.pricing_district || '',
      is_active: room.is_active,
      calendar_ids: calendarIds,
      calendar_sources: calendarSources,
      amenities: Array.isArray(room.amenities) ? room.amenities as string[] : [],
      image_urls: Array.isArray(room.image_urls) ? room.image_urls : (room.image_url ? [room.image_url] : []),
      pricing_tiers: room.pricing_tiers || [],
      stay_discounts: room.stay_discounts || [],
    });
    setInitialCalendarData({
      calendar_ids: [...calendarIds],
      calendar_sources: { ...calendarSources },
    });
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen || editingRoom) {
      return;
    }

    if (createPropertyId && properties.some((property) => property.id === createPropertyId)) {
      return;
    }

    const defaultCreatePropertyId = selectedPropertyId !== 'all'
      ? (properties.some((property) => property.id === selectedPropertyId) ? selectedPropertyId : properties[0]?.id || '')
      : (properties[0]?.id || '');

    setCreatePropertyId(defaultCreatePropertyId);
  }, [createPropertyId, dialogOpen, editingRoom, properties, selectedPropertyId]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Room name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const writePropertyId = editingRoom?.property_id || createRoomPropertyId;
    
    if (editingRoom) {
      // Store previous values for undo
      const previousData = {
        property_id: editingRoom.property_id,
        name: editingRoom.name,
        category: editingRoom.category,
        description: editingRoom.description,
        price_per_night: editingRoom.price_per_night,
        pricing_country: editingRoom.pricing_country,
        pricing_region: editingRoom.pricing_region,
        pricing_city: editingRoom.pricing_city,
        pricing_district: editingRoom.pricing_district,
        is_active: editingRoom.is_active,
        calendar_ids: editingRoom.calendar_ids,
        calendar_sources: editingRoom.calendar_sources,
        amenities: editingRoom.amenities,
        image_url: editingRoom.image_url,
        image_urls: editingRoom.image_urls,
        pricing_tiers: editingRoom.pricing_tiers,
        stay_discounts: editingRoom.stay_discounts,
      };

      const newData = {
        name: formData.name,
        category: formData.category.trim() || null,
        description: formData.description || null,
        price_per_night: formData.price_per_night.trim() ? parseFloat(formData.price_per_night) : null,
        pricing_country: formData.pricing_country || null,
        pricing_region: formData.pricing_region || null,
        pricing_city: formData.pricing_city.trim() || null,
        pricing_district: formData.pricing_district || null,
        is_active: formData.is_active,
        calendar_ids: formData.calendar_ids,
        calendar_sources: formData.calendar_sources,
        amenities: formData.amenities,
        image_url: formData.image_urls[0] || null,
        image_urls: formData.image_urls,
        pricing_tiers: formData.pricing_tiers as unknown as Json,
        stay_discounts: formData.stay_discounts as unknown as Json,
      };

      await executeUndoable({
        action: async () => {
          const { data, error } = await supabase
            .from('room_units')
            .update({
              property_id: writePropertyId,
              ...newData,
            })
            .eq('id', editingRoom.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        undoAction: async () => {
          await supabase
            .from('room_units')
            .update(previousData as any)
            .eq('id', editingRoom.id);
        },
        successMessage: 'Room Updated',
        successDescription: `${formData.name} has been updated`,
        duration: 10000,
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
          refetchAll();
        },
        onUndo: () => refetchAll(),
        onError: () => {},
      });
    } else {
      // Create new room
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        setSaving(false);
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      
      if (!profile?.organization_id) {
        toast({ title: "Error", description: "No organization", variant: "destructive" });
        setSaving(false);
        return;
      }

      const writePropertyId = createRoomPropertyId;
      if (!writePropertyId) {
        toast({
          title: "Select a property",
          description: "Choose a property for this room before creating it.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      let createdRoomId: string | null = null;

      await executeUndoable({
        action: async () => {
          const { data, error } = await supabase
            .from('room_units')
            .insert([{
              organization_id: profile.organization_id,
              property_id: writePropertyId,
              name: formData.name,
              category: formData.category.trim() || null,
              description: formData.description || null,
              price_per_night: formData.price_per_night.trim() ? parseFloat(formData.price_per_night) : null,
              pricing_country: formData.pricing_country || null,
              pricing_region: formData.pricing_region || null,
              pricing_city: formData.pricing_city.trim() || null,
              pricing_district: formData.pricing_district || null,
              is_active: formData.is_active,
              calendar_ids: formData.calendar_ids,
              calendar_sources: formData.calendar_sources,
              amenities: formData.amenities,
              image_url: formData.image_urls[0] || null,
              image_urls: formData.image_urls,
              pricing_tiers: formData.pricing_tiers as unknown as Json,
              stay_discounts: formData.stay_discounts as unknown as Json,
            }])
            .select()
            .single();

          if (error) throw error;
          createdRoomId = data.id;
          return data;
        },
        undoAction: async () => {
          if (createdRoomId) {
            await supabase.from('room_units').delete().eq('id', createdRoomId);
          }
        },
        successMessage: 'Room Created',
        successDescription: `${formData.name} has been added`,
        duration: 10000,
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
          refetchAll();
        },
        onUndo: () => refetchAll(),
        onError: () => {},
      });
    }

    setSaving(false);
  };

  const handleDelete = async (roomId: string) => {
    const roomToDelete = rooms.find(r => r.id === roomId);
    if (!roomToDelete) return;

    const isRpcInvocationError = (error: unknown) => {
      const typedError = error as { code?: string; message?: string } | null;
      const code = typedError?.code || '';
      const message = typedError?.message || '';
      return code === '42883' || code === '42501' || /function .* does not exist|schema cache|permission denied/i.test(message);
    };

    const { error } = await (supabase as any).rpc('archive_room_deletion', {
      _room_id: roomId,
    });

    if (error && !isRpcInvocationError(error)) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete room',
        variant: 'destructive',
      });
      return;
    }

    if (error) {
      const { error: fallbackError } = await supabase
        .from('room_units')
        .delete()
        .eq('id', roomId);

      if (fallbackError) {
        toast({
          title: 'Error',
          description: fallbackError.message || 'Failed to delete room',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Room Deleted',
        description: `${roomToDelete.name} was deleted successfully.`,
      });
      refetchAll();
      return;
    }

    toast({
      title: 'Room Deleted',
      description: `${roomToDelete.name} can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
    });
    refetchAll();
  };

  const toggleRoomStatus = async (room: RoomUnit) => {
    const newStatus = !room.is_active;
    
    await executeUndoable({
      action: async () => {
        const { error } = await supabase
          .from('room_units')
          .update({ is_active: newStatus })
          .eq('id', room.id);
        if (error) throw error;
        return { id: room.id };
      },
      undoAction: async () => {
        await supabase
          .from('room_units')
          .update({ is_active: room.is_active })
          .eq('id', room.id);
      },
      successMessage: newStatus ? 'Room Activated' : 'Room Deactivated',
      successDescription: `${room.name} is now ${newStatus ? 'active' : 'inactive'}`,
      duration: 10000,
      onSuccess: () => refetchAll(),
      onUndo: () => refetchAll(),
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to update room status",
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) {
    return <CardListSkeleton count={4} />;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card className="glass">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.activeRooms}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Active Rooms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.totalCapacity}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.roomsWithCalendar}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("glass", stats.roomsWithoutCalendar > 0 && "border-warning/30")}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center",
                stats.roomsWithoutCalendar > 0 ? "bg-warning/10" : "bg-muted"
              )}>
                <AlertCircle className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5",
                  stats.roomsWithoutCalendar > 0 ? "text-warning" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.roomsWithoutCalendar}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">No Calendar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-9 w-full sm:w-[170px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories
                .filter((category) => category !== 'all')
                .map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button
              className="w-full sm:w-auto"
              disabled={!canCreateRoom}
              title={!canCreateRoom ? 'Add a property before creating a room' : undefined}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BedDouble className="w-4 h-4 text-primary" />
                </div>
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-4">
                {!editingRoom && !canCreateRoom && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    Property context is not ready yet. Add at least one property first.
                  </div>
                )}
                {!editingRoom && properties.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="room-property">Property</Label>
                    <Select value={createPropertyId} onValueChange={setCreatePropertyId}>
                      <SelectTrigger id="room-property" className="h-10">
                        <SelectValue placeholder="Select a property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Room Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Deluxe Suite 101"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g., Suite, Standard"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_per_night">Base Price / Night</Label>
                    <Input
                      id="price_per_night"
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.price_per_night}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_per_night: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Room features and amenities..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pricing Location</Label>
                  <LocationPickerFields
                    value={{
                      country: formData.pricing_country,
                      region: formData.pricing_region,
                      city: formData.pricing_city,
                      district: formData.pricing_district,
                    }}
                    onChange={(nextValue) => setFormData((prev) => ({
                      ...prev,
                      pricing_country: nextValue.country || '',
                      pricing_region: nextValue.region || '',
                      pricing_city: nextValue.city || '',
                      pricing_district: nextValue.district || '',
                    }))}
                    extraCountries={[
                      selectedProperty?.country,
                      formData.pricing_country,
                      ...properties.map((property) => property.country),
                      ...rooms.map((room) => room.pricing_country),
                    ]}
                    extraRegions={[
                      formData.pricing_region,
                      selectedProperty?.region,
                      selectedProperty?.state,
                      ...rooms
                        .filter((room) => (room.pricing_country || '') === (formData.pricing_country || ''))
                        .map((room) => room.pricing_region),
                    ]}
                    extraCities={[
                      formData.pricing_city,
                      selectedProperty?.city,
                      ...rooms
                        .filter((room) =>
                          (room.pricing_country || '') === (formData.pricing_country || '') &&
                          (room.pricing_region || '') === (formData.pricing_region || '')
                        )
                        .map((room) => room.pricing_city),
                    ]}
                    extraDistricts={[
                      formData.pricing_district,
                      ...rooms
                        .filter((room) =>
                          (room.pricing_country || '') === (formData.pricing_country || '') &&
                          (room.pricing_region || '') === (formData.pricing_region || '') &&
                          (room.pricing_city || '') === (formData.pricing_city || '')
                        )
                        .map((room) => room.pricing_district),
                    ]}
                    className="gap-3 sm:grid-cols-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Structured pricing location improves market segmentation. Leave it unchanged to inherit the property's broader market context.
                  </p>
                </div>
                
                {/* Pricing Tiers */}
                <div className="space-y-3 p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Guest Pricing Tiers</Label>
                      <p className="text-xs text-muted-foreground">Set different prices based on guest count</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        pricing_tiers: [...prev.pricing_tiers, { guests: prev.pricing_tiers.length + 1, price: 0 }]
                      }))}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {formData.pricing_tiers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No pricing tiers set.</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.pricing_tiers.map((tier, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1 flex gap-2">
                            <div className="flex-1">
                              <Label className="text-[10px] text-muted-foreground mb-1 block">Guests</Label>
                              <Input
                                type="number"
                                min={1}
                                value={tier.guests}
                                onChange={(e) => {
                                  const newTiers = [...formData.pricing_tiers];
                                  newTiers[index].guests = parseInt(e.target.value) || 1;
                                  setFormData(prev => ({ ...prev, pricing_tiers: newTiers }));
                                }}
                                placeholder="Guests"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-[10px] text-muted-foreground mb-1 block">Price/Night</Label>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={tier.price}
                                onChange={(e) => {
                                  const newTiers = [...formData.pricing_tiers];
                                  newTiers[index].price = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, pricing_tiers: newTiers }));
                                }}
                                placeholder="Price"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0 mt-4"
                            onClick={() => {
                              const newTiers = formData.pricing_tiers.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, pricing_tiers: newTiers }));
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stay Discounts */}
                <div className="space-y-3 p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Stay Discounts</Label>
                      <p className="text-xs text-muted-foreground">Offer discounts for longer stays</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        stay_discounts: [...prev.stay_discounts, { min_nights: 3, discount_percent: 5 }]
                      }))}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {formData.stay_discounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No stay discounts set.</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.stay_discounts.map((discount, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1 flex gap-2">
                            <div className="flex-1">
                              <Label className="text-[10px] text-muted-foreground mb-1 block">Min Nights</Label>
                              <Input
                                type="number"
                                min={1}
                                value={discount.min_nights}
                                onChange={(e) => {
                                  const newDiscounts = [...formData.stay_discounts];
                                  newDiscounts[index].min_nights = parseInt(e.target.value) || 1;
                                  setFormData(prev => ({ ...prev, stay_discounts: newDiscounts }));
                                }}
                                placeholder="Min nights"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-[10px] text-muted-foreground mb-1 block">Discount %</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={discount.discount_percent}
                                onChange={(e) => {
                                  const newDiscounts = [...formData.stay_discounts];
                                  newDiscounts[index].discount_percent = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, stay_discounts: newDiscounts }));
                                }}
                                placeholder="Discount %"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0 mt-4"
                            onClick={() => {
                              const newDiscounts = formData.stay_discounts.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, stay_discounts: newDiscounts }));
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Google Calendars</Label>
                  <CalendarSelector
                    value={formData.calendar_ids}
                    onChange={(calendarIds) => setFormData(prev => ({ ...prev, calendar_ids: calendarIds }))}
                    calendarSources={formData.calendar_sources}
                    onSourcesChange={(sources) => setFormData(prev => ({ ...prev, calendar_sources: sources }))}
                    initialCalendarIds={initialCalendarData.calendar_ids}
                    initialCalendarSources={initialCalendarData.calendar_sources}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Room Images</Label>
                  <MultiImageUpload
                    value={formData.image_urls}
                    onChange={(urls) => setFormData(prev => ({ ...prev, image_urls: urls }))}
                    folder="rooms"
                    maxImages={10}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label htmlFor="is_active" className="cursor-pointer">Active Status</Label>
                    <p className="text-xs text-muted-foreground">Room will be available for bookings</p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 sm:p-6 border-t gap-2 shrink-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || (!editingRoom && !canCreateRoom)}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingRoom ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rooms Grid */}
      {rooms.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BedDouble className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No rooms yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Add your first room to start managing your accommodation.
            </p>
          </CardContent>
        </Card>
      ) : filteredRooms.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No matching rooms</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              No rooms match your current search or category filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRooms.map((room) => {
            const hasNoCalendar = room.is_active && (!room.calendar_ids || room.calendar_ids.length === 0);
            return (
              <Card 
                key={room.id}
                className={cn(
                  "glass overflow-hidden transition-all",
                  !room.is_active && "opacity-60",
                  hasNoCalendar && "border-l-2 border-l-warning"
                )}
              >
                {(room.image_urls?.length > 0 || room.image_url) && (
                  <div className="h-32 w-full overflow-hidden relative shrink-0">
                    <img 
                      src={room.image_urls?.[0] || room.image_url || ''} 
                      alt={room.name} 
                      className="w-full h-full object-cover"
                    />
                    {room.image_urls?.length > 1 && (
                      <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-background/80 text-foreground px-1.5 py-0.5 rounded">
                        +{room.image_urls.length - 1} more
                      </span>
                    )}
                  </div>
                )}
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!room.image_url && (
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          room.is_active ? "bg-primary/20" : "bg-muted"
                        )}>
                          <BedDouble className={cn(
                            "w-5 h-5",
                            room.is_active ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{room.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {room.category && (
                            <Badge variant="outline" className="text-[10px]">
                              {room.category}
                            </Badge>
                          )}
                          <Badge variant={room.is_active ? "default" : "secondary"} className="text-[10px]">
                            {room.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {hasNoCalendar && (
                            <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                              No sync
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {room.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{room.description}</p>
                  )}

                  {getPricingLocationLabel({
                    country: room.pricing_country,
                    region: room.pricing_region,
                    city: room.pricing_city,
                    district: room.pricing_district,
                  }) && (
                    <div className="mb-3">
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                        Pricing market: {getPricingLocationLabel({
                          country: room.pricing_country,
                          region: room.pricing_region,
                          city: room.pricing_city,
                          district: room.pricing_district,
                        })}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    {room.pricing_tiers.length > 0 && (
                      <>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {Math.max(...room.pricing_tiers.map(t => t.guests))} guests
                        </span>
                        <span className="text-primary font-medium">
                          {formatCurrency(Math.min(...room.pricing_tiers.map(t => t.price)))}/night
                        </span>
                      </>
                    )}
                    {room.pricing_tiers.length === 0 && room.price_per_night != null && (
                      <span className="text-primary font-medium">
                        {formatCurrency(room.price_per_night)}/night
                      </span>
                    )}
                    {room.calendar_ids && room.calendar_ids.length > 0 && (
                      <span className="flex items-center gap-1 text-success">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {room.calendar_ids.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEditDialog(room)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => toggleRoomStatus(room)}>
                      {room.is_active ? 'Off' : 'On'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Room?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{room.name}" and its related room data will stay recoverable for {RECOVERY_WINDOW_HOURS} hours from Deleted Items before permanent removal.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(room.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

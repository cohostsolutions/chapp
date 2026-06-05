import { useState, useMemo, useCallback, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Grid3X3,
  List,
  Pencil,
  Trash2,
  Loader2,
  ArrowUpDown,
  DollarSign,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MultiImageUpload } from '@/components/shared/MultiImageUpload';
import type { useOrdersData } from '@/hooks/useOrdersData';
import { supabase } from '@/integrations/supabase/client';
import { useCurrencySymbol } from '@/hooks/useMultiCurrency';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { PrepConfig } from '@/hooks/useOrdersData';

interface MenuItemsTabContentProps {
  ordersData: ReturnType<typeof useOrdersData>;
}

interface MenuItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  is_active: boolean;
  price?: number;
  image_url: string | null;
  image_urls?: string[];
  display_order: number;
}

function formatDaysLabel(days: string) {
  const numericDays = Number(days) || 0;
  return `${numericDays} day${numericDays === 1 ? '' : 's'}`;
}

export default function MenuItemsTabContent({ ordersData }: MenuItemsTabContentProps) {
  const { refetchAll, prepConfigs } = ordersData;
  const { profile, effectiveIsClientAdmin } = useAuth();
  const currencySymbol = useCurrencySymbol();
  const { toast } = useToast();
  
  // Local state for menu items (fetched directly for full control)
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'date'>('date');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    price: '',
    is_active: true,
    image_urls: [] as string[],
    prep_duration_days: '1',
    reminder_offset_days: '0',
    buffer_days: '0',
  });

  const prepConfigByMenuItemId = useMemo(() => {
    return prepConfigs.reduce<Record<string, PrepConfig>>((acc, config) => {
      acc[config.menu_item_id] = config;
      return acc;
    }, {});
  }, [prepConfigs]);

  // Fetch menu items
  const fetchMenuItems = useCallback(async () => {
    if (!profile?.organization_id) return;
    
    try {
      const { data, error } = await supabase
        .from('knowledge_base_entries')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('category', 'menu')
        .order('display_order');

      if (error) throw error;

      const itemsWithPrice = (data || []).map(item => {
        const priceMatch = item.content.match(/Price:\s*(?:[^\d\n]+)?([\d.]+)/i);
        return {
          ...item,
          price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
          display_order: item.display_order || 0,
          subcategory: item.tags?.[0] || null,
        };
      });

      setItems(itemsWithPrice);
    } catch (error) {
      devError('Error fetching menu items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch menu items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, toast]);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  // Categories from items
  const categories = useMemo(
    () => ['all', ...new Set(items.map(m => m.subcategory).filter(Boolean) as string[])],
    [items]
  );

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.subcategory === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.title.localeCompare(b.title);
          case 'price':
            return (b.price || 0) - (a.price || 0);
          case 'date':
          default:
            return a.display_order - b.display_order;
        }
      });
  }, [items, searchTerm, selectedCategory, sortBy]);

  // Open add dialog
  const openAddDialog = () => {
    setSelectedItem(null);
    setFormData({
      title: '',
      content: '',
      category: '',
      price: '',
      is_active: true,
      image_urls: [],
      prep_duration_days: '1',
      reminder_offset_days: '0',
      buffer_days: '0',
    });
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (item: MenuItem) => {
    setSelectedItem(item);
    const descriptionWithoutPrice = item.content.replace(/\nPrice:\s*(?:[^\d\n]+)?[\d.]+/gi, '').trim();
    const prepConfig = prepConfigByMenuItemId[item.id];
    setFormData({
      title: item.title,
      content: descriptionWithoutPrice,
      category: item.subcategory || '',
      price: item.price?.toString() || '',
      is_active: item.is_active,
      image_urls: Array.isArray(item.image_urls) ? item.image_urls : (item.image_url ? [item.image_url] : []),
      prep_duration_days: String(prepConfig?.prep_duration_days ?? 1),
      reminder_offset_days: String(prepConfig?.reminder_offset_days ?? 0),
      buffer_days: String(prepConfig?.buffer_days ?? 0),
    });
    setDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (item: MenuItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !profile?.organization_id) return;

    setIsSubmitting(true);

    try {
      let content = formData.content.trim();
      if (formData.price) {
        content += `\nPrice: ${currencySymbol}${parseFloat(formData.price).toFixed(2)}`;
      }

      let persistedItemId = selectedItem?.id ?? null;

      if (selectedItem) {
        // Update existing
        const { error } = await supabase
          .from('knowledge_base_entries')
          .update({
            title: formData.title.trim(),
            content,
            tags: formData.category ? [formData.category] : [],
            is_active: formData.is_active,
            image_url: formData.image_urls[0] || null,
            image_urls: formData.image_urls,
          })
          .eq('id', selectedItem.id);

        if (error) throw error;

        toast({
          title: "Item Updated",
          description: `${formData.title} has been updated`,
        });
      } else {
        // Create new
        const { data: insertedItem, error } = await supabase
          .from('knowledge_base_entries')
          .insert({
            title: formData.title.trim(),
            content,
            category: 'menu',
            tags: formData.category ? [formData.category] : [],
            is_active: formData.is_active,
            organization_id: profile.organization_id,
            image_url: formData.image_urls[0] || null,
            image_urls: formData.image_urls,
          })
          .select('id')
          .single();

        if (error) throw error;
        persistedItemId = insertedItem?.id ?? null;

        toast({
          title: "Item Added",
          description: `${formData.title} has been added to the menu`,
        });
      }

      if (persistedItemId) {
        const { error: prepConfigError } = await supabase
          .from('order_prep_configs' as any)
          .upsert({
            organization_id: profile.organization_id,
            menu_item_id: persistedItemId,
            prep_duration_days: Math.max(1, Number(formData.prep_duration_days) || 1),
            reminder_offset_days: Math.max(0, Number(formData.reminder_offset_days) || 0),
            buffer_days: Math.max(0, Number(formData.buffer_days) || 0),
            is_active: formData.is_active,
          }, { onConflict: 'organization_id,menu_item_id' });

        if (prepConfigError) throw prepConfigError;
      }

      setDialogOpen(false);
      fetchMenuItems();
      refetchAll();
    } catch (error) {
      devError('Error saving menu item:', error);
      toast({
        title: "Error",
        description: "Failed to save menu item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from('knowledge_base_entries')
        .delete()
        .eq('id', selectedItem.id);

      if (error) throw error;

      toast({
        title: "Item Deleted",
        description: `${selectedItem.title} has been removed`,
      });

      setDeleteDialogOpen(false);
      fetchMenuItems();
      refetchAll();
    } catch (error) {
      devError('Error deleting menu item:', error);
      toast({
        title: "Error",
        description: "Failed to delete menu item",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'date') => setSortBy(value)}>
            <SelectTrigger className="w-[130px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Order</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}>
            <ToggleGroupItem value="grid" size="sm">
              <Grid3X3 className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap flex-1">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All' : category}
              </Button>
            ))}
          </div>
          <Button variant="glow" onClick={openAddDialog} size="sm" disabled={!effectiveIsClientAdmin}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Menu Items */}
      <div className={viewMode === 'grid' ? "grid gap-3 md:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
        {filteredItems.length === 0 ? (
          <Card className={`glass ${viewMode === 'grid' ? 'md:col-span-2 lg:col-span-3' : ''}`}>
            <CardContent className="p-8 text-center">
              <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No menu items found</p>
              <Button variant="glow" size="sm" className="mt-4" onClick={openAddDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Menu Item
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          filteredItems.map(item => (
            <Card key={item.id} className="glass hover:border-primary/50 transition-colors group">
              {(item.image_urls?.length > 0 || item.image_url) && (
                <div className="aspect-video w-full overflow-hidden rounded-t-lg relative">
                  <img 
                    src={item.image_urls?.[0] || item.image_url || ''} 
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {item.image_urls?.length > 1 && (
                    <span className="absolute bottom-2 right-2 text-xs bg-background/80 text-foreground px-2 py-1 rounded">
                      +{item.image_urls.length - 1} more
                    </span>
                  )}
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    {!item.is_active && (
                      <Badge variant="secondary" className="text-xs mt-1">Inactive</Badge>
                    )}
                    {prepConfigByMenuItemId[item.id] && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Prep {formatDaysLabel(String(prepConfigByMenuItemId[item.id].prep_duration_days))}
                      </Badge>
                    )}
                  </div>
                  {item.price && (
                    <div className="text-success font-semibold">
                      {currencySymbol}{item.price.toFixed(2)}
                    </div>
                  )}
                </div>
                {item.content && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {item.content.replace(/\nPrice:\s*(?:[^\d\n]+)?[\d.]+/gi, '')}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {item.subcategory && (
                    <Badge variant="secondary" className="text-xs">
                      {item.subcategory}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)} disabled={!effectiveIsClientAdmin}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(item)} disabled={!effectiveIsClientAdmin}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} className="glass hover:border-primary/50 transition-colors group">
              <CardContent className="p-3 flex items-center gap-3">
                {(item.image_urls?.length > 0 || item.image_url) && (
                  <div className="relative">
                    <img 
                      src={item.image_urls?.[0] || item.image_url || ''} 
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    {item.image_urls?.length > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-background/90 text-foreground px-1 py-0.5 rounded">
                        +{item.image_urls.length - 1}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                      {!item.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    {item.price && (
                      <span className="text-success font-semibold shrink-0">{currencySymbol}{item.price.toFixed(2)}</span>
                    )}
                  </div>
                  {item.content && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.content.replace(/\nPrice:\s*(?:[^\d\n]+)?[\d.]+/gi, '')}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.subcategory && (
                      <Badge variant="secondary" className="text-xs">{item.subcategory}</Badge>
                    )}
                    {prepConfigByMenuItemId[item.id] && (
                      <Badge variant="outline" className="text-xs">
                        Prep {formatDaysLabel(String(prepConfigByMenuItemId[item.id].prep_duration_days))}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)} disabled={!effectiveIsClientAdmin}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(item)} disabled={!effectiveIsClientAdmin}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-warning" />
              {selectedItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {!effectiveIsClientAdmin && (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Only client admins can change menu items and prep timing.
              </p>
            )}
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                placeholder="e.g., Chicken Adobo"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                disabled={!effectiveIsClientAdmin}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ({currencySymbol})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="pl-12"
                    disabled={!effectiveIsClientAdmin}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  placeholder="e.g., Main Course"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  disabled={!effectiveIsClientAdmin}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the menu item..."
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
                disabled={!effectiveIsClientAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label>Prep Timing</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Prep (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.prep_duration_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, prep_duration_days: e.target.value }))}
                    disabled={!effectiveIsClientAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Reminder (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.reminder_offset_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminder_offset_days: e.target.value }))}
                    disabled={!effectiveIsClientAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Buffer (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.buffer_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, buffer_days: e.target.value }))}
                    disabled={!effectiveIsClientAdmin}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                These timings now work in days. They still generate May's internal prep blocks and reminder windows before the customer-facing pickup time.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Menu Item Images</Label>
              <MultiImageUpload
                value={formData.image_urls}
                onChange={(urls) => setFormData(prev => ({ ...prev, image_urls: urls }))}
                folder="menu-images"
                maxImages={10}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active" className="cursor-pointer">Active on menu</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                disabled={!effectiveIsClientAdmin}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" disabled={!effectiveIsClientAdmin || isSubmitting || !formData.title.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {selectedItem ? 'Save Changes' : 'Add Item'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedItem?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

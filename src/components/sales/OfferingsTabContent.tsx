import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Briefcase,
  Search,
  DollarSign,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { MultiImageUpload } from '@/components/shared/MultiImageUpload';
import type { useSalesData } from '@/hooks/useSalesData';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrencySymbol } from '@/hooks/useMultiCurrency';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OfferingsTabContentProps {
  salesData: ReturnType<typeof useSalesData>;
}

interface Offering {
  id: string;
  name: string;
  description?: string | null;
  price: number | null;
  category: string | null;
  is_active: boolean;
  image_url?: string | null;
  image_urls?: string[];
  display_order?: number | null;
}

type SortOption = 'name' | 'price' | 'date';

export default function OfferingsTabContent({ salesData }: OfferingsTabContentProps) {
  const { offerings, refetchAll } = salesData;
  const { profile } = useAuth();
  const currencySymbol = useCurrencySymbol();
  const { toast } = useToast();

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    is_active: true,
    image_urls: [] as string[],
  });

  // Extract unique categories
  const categories = useMemo(
    () => ['all', ...new Set(offerings.map(o => o.category).filter(Boolean) as string[])],
    [offerings]
  );

  // Filter and sort offerings
  const filteredOfferings = useMemo(() => {
    let result = offerings.filter(offering => {
      const matchesSearch = offering.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offering.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offering.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || offering.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'date':
      default:
        // Keep original order (by display_order or created_at)
        break;
    }

    return result;
  }, [offerings, searchTerm, selectedCategory, sortBy]);

  // Open add dialog
  const openAddDialog = useCallback(() => {
    setSelectedOffering(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      price: '',
      is_active: true,
      image_urls: [],
    });
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const openEditDialog = useCallback((offering: Offering) => {
    setSelectedOffering(offering);
    setFormData({
      name: offering.name,
      description: offering.description || '',
      category: offering.category || '',
      price: offering.price?.toString() || '',
      is_active: offering.is_active,
      image_urls: Array.isArray(offering.image_urls) ? offering.image_urls : (offering.image_url ? [offering.image_url] : []),
    });
    setDialogOpen(true);
  }, []);

  // Open delete dialog
  const openDeleteDialog = useCallback((offering: Offering) => {
    setSelectedOffering(offering);
    setDeleteDialogOpen(true);
  }, []);

  // Handle form submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter an offering name.',
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

    setIsSubmitting(true);

    try {
      const offeringData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        is_active: formData.is_active,
        image_url: formData.image_urls[0] || null,
        image_urls: formData.image_urls,
      };

      if (selectedOffering) {
        // Update existing
        const { error } = await supabase
          .from('offerings')
          .update(offeringData)
          .eq('id', selectedOffering.id);

        if (error) throw error;

        toast({
          title: 'Offering Updated',
          description: `${formData.name} has been updated`,
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('offerings')
          .insert({
            ...offeringData,
            organization_id: profile.organization_id,
          });

        if (error) throw error;

        toast({
          title: 'Offering Added',
          description: `${formData.name} has been added`,
        });
      }

      setDialogOpen(false);
      refetchAll();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save offering',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, selectedOffering, profile?.organization_id, toast, refetchAll]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!selectedOffering) return;

    try {
      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', selectedOffering.id);

      if (error) throw error;

      toast({
        title: 'Offering Deleted',
        description: `${selectedOffering.name} has been removed`,
      });

      setDeleteDialogOpen(false);
      refetchAll();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete offering',
        variant: 'destructive',
      });
    }
  }, [selectedOffering, toast, refetchAll]);

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search offerings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[130px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              <SelectItem value="date">Date Added</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="glow"
            onClick={openAddDialog}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Offering</span>
          </Button>
        </div>
        
        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap">
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
        )}
      </div>

      {/* Offerings Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredOfferings.length === 0 ? (
          <Card className="glass md:col-span-2 lg:col-span-3">
            <CardContent className="p-8 text-center">
              <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {offerings.length === 0 ? 'No offerings yet' : 'No offerings found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {offerings.length === 0 
                  ? 'Add your products or services for Jay to discuss with leads'
                  : 'Try adjusting your search or filters'
                }
              </p>
              {offerings.length === 0 && (
                <Button variant="glow" onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Offering
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredOfferings.map(offering => (
            <Card key={offering.id} className="glass hover:border-primary/50 transition-colors">
              {(offering.image_urls?.length > 0 || offering.image_url) && (
                <div className="aspect-video w-full overflow-hidden rounded-t-lg relative">
                  <img 
                    src={offering.image_urls?.[0] || offering.image_url || ''} 
                    alt={offering.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {offering.image_urls?.length > 1 && (
                    <span className="absolute bottom-2 right-2 text-xs bg-background/80 text-foreground px-2 py-1 rounded">
                      +{offering.image_urls.length - 1} more
                    </span>
                  )}
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{offering.name}</h3>
                    {offering.price && (
                      <div className="text-success font-semibold text-sm mt-0.5">
                        {currencySymbol}{offering.price.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={offering.is_active 
                      ? "bg-success/20 text-success border-success/30" 
                      : "bg-muted text-muted-foreground"
                    }
                  >
                    {offering.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                {offering.category && (
                  <div className="flex items-center gap-1 mb-2">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{offering.category}</span>
                  </div>
                )}
                
                {offering.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {offering.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openEditDialog(offering)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => openDeleteDialog(offering)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              {selectedOffering ? 'Edit Offering' : 'Add Offering'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Premium Consultation Package"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., Consulting, Product, Service"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="pl-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the offering, features, benefits..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Offering Images</Label>
              <MultiImageUpload
                value={formData.image_urls}
                onChange={(urls) => setFormData(prev => ({ ...prev, image_urls: urls }))}
                folder="offerings"
                maxImages={10}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
                <p className="text-xs text-muted-foreground">Show this offering to Jay AI</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {selectedOffering ? 'Update' : 'Add'} Offering
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offering</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedOffering?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

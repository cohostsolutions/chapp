import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { LocationPickerFields } from '@/components/shared/LocationPickerFields';
import { useToast } from '@/hooks/use-toast';
import { usePricingMarketProfiles, type PricingMarketProfileInput, type PricingMarketProfileRecord, type PricingMarketScope } from '@/hooks/usePricingMarketProfiles';
import { getPricingLocationLabel } from '@/lib/pricingLocationCatalog';
import type { Property, RoomUnit } from '@/hooks/useAccommodationData';

interface PricingTabContentProps {
  properties: Property[];
  rooms: RoomUnit[];
}

interface FormState {
  country: string;
  region: string;
  city: string;
  district: string;
  multiplier: string;
  marketPositioning: string;
  adjustmentLabel: string;
  isActive: boolean;
  displayOrder: string;
}

const defaultFormState: FormState = {
  country: '',
  region: '',
  city: '',
  district: '',
  multiplier: '1.000',
  marketPositioning: '',
  adjustmentLabel: '',
  isActive: true,
  displayOrder: '0',
};

const MAX_MULTIPLIER = 3;

function normalizePart(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function matchesProfileUsage(profile: PricingMarketProfileRecord, location: { country?: string | null; region?: string | null; city?: string | null; district?: string | null }): boolean {
  const profileCountry = normalizePart(profile.country);
  const profileRegion = normalizePart(profile.region);
  const profileCity = normalizePart(profile.city);
  const profileDistrict = normalizePart(profile.district);

  const locationCountry = normalizePart(location.country);
  const locationRegion = normalizePart(location.region);
  const locationCity = normalizePart(location.city);
  const locationDistrict = normalizePart(location.district);

  if (!profileCountry || locationCountry !== profileCountry) {
    return false;
  }

  if (profile.scope === 'country') {
    return true;
  }

  if (!profileRegion || locationRegion !== profileRegion) {
    return false;
  }

  if (profile.scope === 'region') {
    return true;
  }

  if (!profileCity || locationCity !== profileCity) {
    return false;
  }

  if (profile.scope === 'city') {
    return true;
  }

  return !!profileDistrict && locationDistrict === profileDistrict;
}

function inferScope(form: FormState): PricingMarketScope {
  if (form.district) return 'district';
  if (form.city) return 'city';
  if (form.region) return 'region';
  return 'country';
}

function profileToForm(profile: PricingMarketProfileRecord): FormState {
  return {
    country: profile.country || '',
    region: profile.region || '',
    city: profile.city || '',
    district: profile.district || '',
    multiplier: profile.multiplier.toFixed(3),
    marketPositioning: profile.market_positioning,
    adjustmentLabel: profile.adjustment_label,
    isActive: profile.is_active,
    displayOrder: String(profile.display_order),
  };
}

export function PricingTabContent({ properties, rooms }: PricingTabContentProps) {
  const { toast } = useToast();
  const { profiles, activeProfiles, isLoading, createProfile, updateProfile, deleteProfile, seedDefaultProfiles } = usePricingMarketProfiles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PricingMarketProfileRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState);

  const parsedMultiplier = Number.parseFloat(form.multiplier);
  const parsedDisplayOrder = Number.parseInt(form.displayOrder, 10);
  const isMultiplierValid = Number.isFinite(parsedMultiplier) && parsedMultiplier > 0 && parsedMultiplier <= MAX_MULTIPLIER;
  const isDisplayOrderValid = Number.isFinite(parsedDisplayOrder);
  const isFormValid = !!form.country && isMultiplierValid && isDisplayOrderValid && !!form.marketPositioning.trim() && !!form.adjustmentLabel.trim();

  useEffect(() => {
    if (!dialogOpen) {
      setEditingProfile(null);
      setForm(defaultFormState);
    }
  }, [dialogOpen]);

  const handleEdit = (profile: PricingMarketProfileRecord) => {
    setEditingProfile(profile);
    setForm(profileToForm(profile));
    setDialogOpen(true);
  };

  const handleDelete = (profile: PricingMarketProfileRecord) => {
    const propertyInUse = properties.some((property) =>
      matchesProfileUsage(profile, {
        country: property.country,
        region: property.region || property.state,
        city: property.city,
      })
    );

    const roomInUse = rooms.some((room) =>
      matchesProfileUsage(profile, {
        country: room.pricing_country,
        region: room.pricing_region,
        city: room.pricing_city,
        district: room.pricing_district,
      })
    );

    if (propertyInUse || roomInUse) {
      toast({
        title: 'Profile in use',
        description: 'This pricing profile is currently used by existing properties or rooms and cannot be deleted.',
        variant: 'destructive',
      });
      return;
    }

    deleteProfile.mutate(profile.id);
  };

  const handleSubmit = async () => {
    const multiplier = Number.parseFloat(form.multiplier);
    const displayOrder = Number.parseInt(form.displayOrder, 10);

    if (!form.country) {
      toast({
        title: 'Missing country',
        description: 'Select at least a country for this pricing profile.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > MAX_MULTIPLIER) {
      toast({
        title: 'Invalid multiplier',
        description: `Multiplier must be a valid number greater than 0 and up to ${MAX_MULTIPLIER}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(displayOrder)) {
      toast({
        title: 'Invalid display order',
        description: 'Display order must be a valid whole number.',
        variant: 'destructive',
      });
      return;
    }

    if (!form.marketPositioning.trim() || !form.adjustmentLabel.trim()) {
      toast({
        title: 'Missing details',
        description: 'Market positioning and adjustment label are required.',
        variant: 'destructive',
      });
      return;
    }

    const input: PricingMarketProfileInput = {
      scope: inferScope(form),
      country: form.country,
      region: form.region || null,
      city: form.city || null,
      district: form.district || null,
      multiplier,
      market_positioning: form.marketPositioning.trim(),
      adjustment_label: form.adjustmentLabel.trim(),
      is_active: form.isActive,
      display_order: displayOrder,
    };

    if (editingProfile) {
      await updateProfile.mutateAsync({ id: editingProfile.id, input });
    } else {
      await createProfile.mutateAsync(input);
    }

    setDialogOpen(false);
  };

  if (isLoading) {
    return <CardListSkeleton count={3} />;
  }

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Market Pricing Profiles
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tune dynamic pricing by country, region, city, or district without redeploying.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profiles.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => seedDefaultProfiles.mutate()} disabled={seedDefaultProfiles.isPending}>
                {seedDefaultProfiles.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Sparkles className="w-4 h-4 mr-2" />
                Seed Recommended
              </Button>
            )}
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Active: {activeProfiles.length}</Badge>
            <Badge variant="outline">Total: {profiles.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Positioning</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No custom pricing profiles yet. Seed recommended profiles or add your own.
                  </TableCell>
                </TableRow>
              ) : profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="capitalize">{profile.scope}</TableCell>
                  <TableCell>{getPricingLocationLabel(profile) || '-'}</TableCell>
                  <TableCell>{profile.multiplier.toFixed(3)}x</TableCell>
                  <TableCell>{profile.market_positioning}</TableCell>
                  <TableCell>
                    <Badge variant={profile.is_active ? 'default' : 'secondary'}>{profile.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button variant="outline" size="sm" aria-label={`Edit ${profile.adjustment_label}`} onClick={() => handleEdit(profile)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Delete ${profile.adjustment_label}`}
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(profile)}
                        disabled={deleteProfile.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit Pricing Profile' : 'Add Pricing Profile'}</DialogTitle>
            <DialogDescription>Create an organization-level pricing rule for a specific market segment.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 py-2">
            <LocationPickerFields
              value={form}
              onChange={(nextValue) => setForm((current) => ({
                ...current,
                country: nextValue.country || '',
                region: nextValue.region || '',
                city: nextValue.city || '',
                district: nextValue.district || '',
              }))}
              extraCountries={[
                ...properties.map((property) => property.country),
                ...rooms.map((room) => room.pricing_country),
                ...profiles.map((profile) => profile.country),
              ]}
              extraRegions={[
                ...properties.map((property) => property.region || property.state),
                ...rooms.map((room) => room.pricing_region),
                ...profiles.map((profile) => profile.region),
              ]}
              extraCities={[
                ...properties.map((property) => property.city),
                ...rooms.map((room) => room.pricing_city),
                ...profiles.map((profile) => profile.city),
              ]}
              extraDistricts={[
                ...rooms.map((room) => room.pricing_district),
                ...profiles.map((profile) => profile.district),
              ]}
              className="md:col-span-2"
            />
            <div className="space-y-2">
              <Label>Multiplier</Label>
              <Input
                type="number"
                min="0.001"
                max={String(MAX_MULTIPLIER)}
                step="0.001"
                value={form.multiplier}
                onChange={(event) => setForm((current) => ({ ...current, multiplier: event.target.value }))}
                placeholder="1.120"
              />
              <p className="text-xs text-muted-foreground">Allowed range: 0.001 to {MAX_MULTIPLIER}.</p>
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input value={form.displayOrder} onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Market Positioning</Label>
              <Input value={form.marketPositioning} onChange={(event) => setForm((current) => ({ ...current, marketPositioning: event.target.value }))} placeholder="Prime district market" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Adjustment Label</Label>
              <Input value={form.adjustmentLabel} onChange={(event) => setForm((current) => ({ ...current, adjustmentLabel: event.target.value }))} placeholder="prime district premium" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 md:col-span-2">
              <div>
                <Label htmlFor="profile-active">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive profiles stay stored but are ignored by pricing.</p>
              </div>
              <Switch id="profile-active" checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || createProfile.isPending || updateProfile.isPending}>
              {(createProfile.isPending || updateProfile.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProfile ? 'Save Changes' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
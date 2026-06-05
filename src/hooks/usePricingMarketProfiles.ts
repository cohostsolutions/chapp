import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, DeletionCancelledError, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

export type PricingMarketScope = 'country' | 'region' | 'city' | 'district';

export interface PricingMarketProfileRecord {
  id: string;
  organization_id: string;
  scope: PricingMarketScope;
  country: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  multiplier: number;
  market_positioning: string;
  adjustment_label: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PricingMarketProfileInput {
  scope: PricingMarketScope;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  multiplier: number;
  market_positioning: string;
  adjustment_label: string;
  is_active?: boolean;
  display_order?: number;
}

export const DEFAULT_PRICING_MARKET_PROFILE_TEMPLATES: PricingMarketProfileInput[] = [
  {
    scope: 'district',
    country: 'Philippines',
    region: 'Metro Manila',
    city: 'Taguig',
    district: 'Bonifacio Global City',
    multiplier: 1.18,
    market_positioning: 'Prime district market',
    adjustment_label: 'prime district premium',
    display_order: 1,
  },
  {
    scope: 'district',
    country: 'Philippines',
    region: 'Metro Manila',
    city: 'Makati',
    district: 'Makati CBD',
    multiplier: 1.18,
    market_positioning: 'Prime district market',
    adjustment_label: 'prime district premium',
    display_order: 2,
  },
  {
    scope: 'district',
    country: 'Philippines',
    region: 'Metro Manila',
    city: 'Pasig',
    district: 'Ortigas Center',
    multiplier: 1.18,
    market_positioning: 'Prime district market',
    adjustment_label: 'prime district premium',
    display_order: 3,
  },
  {
    scope: 'district',
    country: 'Philippines',
    region: 'Central Visayas',
    city: 'Cebu City',
    district: 'Cebu IT Park',
    multiplier: 1.18,
    market_positioning: 'Prime district market',
    adjustment_label: 'prime district premium',
    display_order: 4,
  },
  {
    scope: 'city',
    country: 'Philippines',
    region: 'Metro Manila',
    city: 'Taguig',
    multiplier: 1.12,
    market_positioning: 'Premium business district market',
    adjustment_label: 'business district premium',
    display_order: 10,
  },
  {
    scope: 'city',
    country: 'Philippines',
    region: 'Metro Manila',
    city: 'Makati',
    multiplier: 1.12,
    market_positioning: 'Premium business district market',
    adjustment_label: 'business district premium',
    display_order: 11,
  },
  {
    scope: 'city',
    country: 'Philippines',
    region: 'Central Visayas',
    city: 'Cebu City',
    multiplier: 1.08,
    market_positioning: 'High-demand urban market',
    adjustment_label: 'high-demand city market',
    display_order: 12,
  },
  {
    scope: 'city',
    country: 'Philippines',
    region: 'CALABARZON',
    city: 'Tagaytay',
    multiplier: 1.12,
    market_positioning: 'Destination resort market',
    adjustment_label: 'destination city demand',
    display_order: 13,
  },
  {
    scope: 'city',
    country: 'Singapore',
    region: 'Central Region',
    city: 'Singapore',
    multiplier: 1.24,
    market_positioning: 'Premium global urban market',
    adjustment_label: 'premium city market',
    display_order: 14,
  },
];

export function usePricingMarketProfiles() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id || null;

  const query = useQuery({
    queryKey: ['pricing-market-profiles', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as PricingMarketProfileRecord[];

      const { data, error } = await supabase
        .from('pricing_market_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as PricingMarketProfileRecord[];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['pricing-market-profiles', organizationId] });
  };

  const createProfile = useMutation({
    mutationFn: async (input: PricingMarketProfileInput) => {
      if (!organizationId) throw new Error('No organization found.');

      const { data, error } = await supabase
        .from('pricing_market_profiles')
        .insert({
          organization_id: organizationId,
          ...input,
          country: input.country || null,
          region: input.region || null,
          city: input.city || null,
          district: input.district || null,
          is_active: input.is_active ?? true,
          display_order: input.display_order ?? 0,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as PricingMarketProfileRecord;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'Pricing profile saved', description: 'The market profile is now active.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save profile', description: error.message, variant: 'destructive' });
    },
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PricingMarketProfileInput }) => {
      const { data, error } = await supabase
        .from('pricing_market_profiles')
        .update({
          ...input,
          country: input.country || null,
          region: input.region || null,
          city: input.city || null,
          district: input.district || null,
          is_active: input.is_active ?? true,
          display_order: input.display_order ?? 0,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as PricingMarketProfileRecord;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'Pricing profile updated', description: 'Changes are now live.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update profile', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const profileName = (query.data || []).find((profile) => profile.id === id)?.adjustment_label || 'this pricing profile';
      if (!confirmRecoverableDeletion(profileName)) throw new DeletionCancelledError();
      await archiveRecoverableRecordDeletion('pricing_market_profiles', id, profileName);
      return id;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'Pricing profile deleted', description: `The rule can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.` });
    },
    onError: (error: Error) => {
      if (error instanceof DeletionCancelledError) return;
      toast({ title: 'Failed to delete profile', description: error.message, variant: 'destructive' });
    },
  });

  const seedDefaultProfiles = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization found.');
      if ((query.data || []).length > 0) throw new Error('Profiles already exist for this organization.');

      const { error } = await supabase
        .from('pricing_market_profiles')
        .insert(DEFAULT_PRICING_MARKET_PROFILE_TEMPLATES.map((profile, index) => ({
          organization_id: organizationId,
          ...profile,
          is_active: true,
          display_order: profile.display_order ?? index + 1,
        })));

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'Recommended profiles added', description: 'You can now tune them from the pricing tab.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to seed profiles', description: error.message, variant: 'destructive' });
    },
  });

  const activeProfiles = useMemo(
    () => (query.data || []).filter((profile) => profile.is_active),
    [query.data]
  );

  return {
    profiles: query.data || [],
    activeProfiles,
    isLoading: query.isLoading,
    refetch: query.refetch,
    createProfile,
    updateProfile,
    deleteProfile,
    seedDefaultProfiles,
    organizationId,
  };
}
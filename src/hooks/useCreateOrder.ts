import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateLead, CreateLeadInput } from './useCreateLead';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

export interface OrderItemInput {
  name: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface OrderData {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  items: OrderItemInput[];
  pickupTime?: string | null;
  notes?: string | null;
  leadSource?: string;
}

interface LeadLookupResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function useCreateOrder() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createLead } = useCreateLead();
  const { defaultCountryCode } = useOrganizationPhone();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(
    async (orderData: OrderData): Promise<{ id: string } | null> => {
      if (!profile?.organization_id) {
        const errorMsg = 'Organization not found';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      // Validate items
      if (!orderData.items || orderData.items.length === 0) {
        const errorMsg = 'At least one item is required';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const normalizedPhone = orderData.customerPhone?.trim()
          ? normalizePhoneNumber(orderData.customerPhone, defaultCountryCode)
          : '';

        if (normalizedPhone && !isValidPhoneNumber(normalizedPhone, defaultCountryCode)) {
          throw new Error(getPhoneValidationMessage(defaultCountryCode));
        }

        const normalizedEmail = orderData.customerEmail?.trim().toLowerCase() || '';

        let lead: LeadLookupResult | null = null;

        if (normalizedPhone) {
          const { data: existingLeadByPhone, error: phoneLookupError } = await supabase
            .from('leads')
            .select('id, name, email, phone')
            .eq('organization_id', profile.organization_id)
            .eq('phone', normalizedPhone)
            .maybeSingle();

          if (phoneLookupError) throw phoneLookupError;
          lead = existingLeadByPhone as LeadLookupResult | null;
        }

        if (!lead && normalizedEmail) {
          const { data: existingLeadByEmail, error: emailLookupError } = await supabase
            .from('leads')
            .select('id, name, email, phone')
            .eq('organization_id', profile.organization_id)
            .ilike('email', normalizedEmail)
            .maybeSingle();

          if (emailLookupError) throw emailLookupError;
          lead = existingLeadByEmail as LeadLookupResult | null;
        }

        if (!lead) {
          const leadInput: CreateLeadInput = {
            name: orderData.customerName,
            phone: normalizedPhone || null,
            email: normalizedEmail || null,
            source: orderData.leadSource || 'manual',
            status: 'new',
            lead_temperature: 'warm',
          };

          lead = await createLead(leadInput);
          if (!lead) {
            return null;
          }
        }

        const totalAmount = orderData.items.reduce(
          (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
          0
        );

        const { data: orderRecord, error: orderError } = await supabase
          .from('orders')
          .insert({
            organization_id: profile.organization_id,
            lead_id: lead.id,
            pickup_name: orderData.customerName.trim(),
            status: 'pending',
            pickup_time: orderData.pickupTime || null,
            notes: orderData.notes || null,
            order_items: orderData.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes || null,
            })),
            total_amount: totalAmount,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        if (!orderRecord) throw new Error('Failed to create order');

        // Invalidate related queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['may-orders'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] }),
          queryClient.invalidateQueries({ queryKey: ['orders'] }),
        ]);

        toast({
          title: 'Success',
          description: `Order created for ${orderData.customerName}`,
        });

        return { id: orderRecord.id };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create order';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultCountryCode, profile?.organization_id, createLead, toast, queryClient]
  );

  return {
    createOrder,
    isLoading,
    error,
  };
}

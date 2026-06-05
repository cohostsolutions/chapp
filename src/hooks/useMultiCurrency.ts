import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devWarn } from '@/lib/logger';
import type { Currency } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// NOTE: The currencies table does not exist yet in the database schema.
// This implementation uses static currency data.

const DEFAULT_CURRENCY_CODE = 'PHP';

export const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchange_rate: 1.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'EUR', name: 'Euro', symbol: '€', exchange_rate: 0.85, is_active: true, updated_at: new Date().toISOString() },
  { code: 'GBP', name: 'British Pound', symbol: '£', exchange_rate: 0.73, is_active: true, updated_at: new Date().toISOString() },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', exchange_rate: 110.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', exchange_rate: 56.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', exchange_rate: 1.25, is_active: true, updated_at: new Date().toISOString() },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchange_rate: 1.35, is_active: true, updated_at: new Date().toISOString() },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', exchange_rate: 1.35, is_active: true, updated_at: new Date().toISOString() },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', exchange_rate: 7.8, is_active: true, updated_at: new Date().toISOString() },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', exchange_rate: 6.45, is_active: true, updated_at: new Date().toISOString() },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchange_rate: 74.5, is_active: true, updated_at: new Date().toISOString() },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', exchange_rate: 1350.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', exchange_rate: 36.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', exchange_rate: 4.7, is_active: true, updated_at: new Date().toISOString() },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', exchange_rate: 16000.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', exchange_rate: 25500.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', exchange_rate: 1550.0, is_active: true, updated_at: new Date().toISOString() },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchange_rate: 3.67, is_active: true, updated_at: new Date().toISOString() },
];

const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  PHP: 'en-PH',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  HKD: 'zh-HK',
  CNY: 'zh-CN',
  INR: 'en-IN',
  KRW: 'ko-KR',
  THB: 'th-TH',
  MYR: 'ms-MY',
  IDR: 'id-ID',
  VND: 'vi-VN',
  NGN: 'en-NG',
  AED: 'en-AE',
};

const getCurrencyByCode = (currencies: Currency[] | undefined, currencyCode: string) => {
  return currencies?.find((currency) => currency.code === currencyCode)
    || DEFAULT_CURRENCIES.find((currency) => currency.code === currencyCode)
    || DEFAULT_CURRENCIES.find((currency) => currency.code === DEFAULT_CURRENCY_CODE);
};

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      // Return static currency data
      return DEFAULT_CURRENCIES;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useUpdateExchangeRates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      // Currencies table not yet implemented - just return success
      devWarn('currencies table not yet implemented');
      return DEFAULT_CURRENCIES.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast({
        title: 'Exchange rates updated',
        description: `Updated ${count} currency rates.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update rates',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useConvertCurrency() {
  const { data: currencies } = useCurrencies();

  return (amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    if (!currencies) return amount;

    const fromCurrency = currencies.find((c) => c.code === from);
    const toCurrency = currencies.find((c) => c.code === to);

    if (!fromCurrency || !toCurrency) return amount;

    // Convert to USD first, then to target currency
    const usdAmount = amount / fromCurrency.exchange_rate;
    return usdAmount * toCurrency.exchange_rate;
  };
}

export function useOrganizationCurrency() {
  const { profile } = useAuth();
  const { data: currencies } = useCurrencies();
  const { data: currencyCode } = useQuery({
    queryKey: ['organization-currency', profile?.organization_id],
    enabled: !!profile?.organization_id,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('currency_code')
        .eq('id', profile?.organization_id)
        .maybeSingle();

      if (error) throw error;

      return data?.currency_code || DEFAULT_CURRENCY_CODE;
    },
  });

  const resolvedCurrencyCode = currencyCode || DEFAULT_CURRENCY_CODE;
  const currency = getCurrencyByCode(currencies, resolvedCurrencyCode);

  return {
    currencyCode: resolvedCurrencyCode,
    currencySymbol: currency?.symbol || '$',
    locale: CURRENCY_LOCALES[resolvedCurrencyCode] || 'en-US',
  };
}

export function useCurrencySymbol() {
  return useOrganizationCurrency().currencySymbol;
}

export function useFormatCurrency() {
  const { data: currencies } = useCurrencies();
  const { currencyCode: organizationCurrencyCode, locale: organizationLocale } = useOrganizationCurrency();

  return (amount: number, currencyCode: string = organizationCurrencyCode, locale: string = organizationLocale): string => {
    const currency = getCurrencyByCode(currencies, currencyCode);
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fallback formatting
      return `${currency?.symbol || '$'}${amount.toFixed(2)}`;
    }
  };
}

// i18n translations (simplified - in production use i18next or similar)
export const translations: Record<string, Record<string, string>> = {
  'en-US': {
    'app.name': 'AlCor Nexus',
    'nav.dashboard': 'Dashboard',
    'nav.leads': 'Leads',
    'nav.orders': 'Orders',
    'nav.settings': 'Settings',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'message.success': 'Success!',
    'message.error': 'An error occurred',
  },
  'es-ES': {
    'app.name': 'AlCor Nexus',
    'nav.dashboard': 'Panel',
    'nav.leads': 'Clientes Potenciales',
    'nav.orders': 'Pedidos',
    'nav.settings': 'Configuración',
    'action.save': 'Guardar',
    'action.cancel': 'Cancelar',
    'action.delete': 'Eliminar',
    'action.edit': 'Editar',
    'message.success': '¡Éxito!',
    'message.error': 'Ocurrió un error',
  },
  'fr-FR': {
    'app.name': 'AlCor Nexus',
    'nav.dashboard': 'Tableau de bord',
    'nav.leads': 'Prospects',
    'nav.orders': 'Commandes',
    'nav.settings': 'Paramètres',
    'action.save': 'Enregistrer',
    'action.cancel': 'Annuler',
    'action.delete': 'Supprimer',
    'action.edit': 'Modifier',
    'message.success': 'Succès!',
    'message.error': 'Une erreur s\'est produite',
  },
  'de-DE': {
    'app.name': 'AlCor Nexus',
    'nav.dashboard': 'Dashboard',
    'nav.leads': 'Leads',
    'nav.orders': 'Bestellungen',
    'nav.settings': 'Einstellungen',
    'action.save': 'Speichern',
    'action.cancel': 'Abbrechen',
    'action.delete': 'Löschen',
    'action.edit': 'Bearbeiten',
    'message.success': 'Erfolg!',
    'message.error': 'Ein Fehler ist aufgetreten',
  },
};

export function useTranslation(locale: string = 'en-US') {
  return (key: string): string => {
    return translations[locale]?.[key] || translations['en-US'][key] || key;
  };
}

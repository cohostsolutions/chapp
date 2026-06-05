import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_COUNTRY_DIAL_CODE,
  getCountryPhoneOption,
  getPhoneFormattingHint,
  getPhonePlaceholder,
  getPhoneValidationMessage,
} from '@/lib/phone';

export function useOrganizationPhone() {
  const { profile } = useAuth();

  const { data: defaultCountryCode } = useQuery({
    queryKey: ['organization-phone', profile?.organization_id],
    enabled: !!profile?.organization_id,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('default_country_code')
        .eq('id', profile?.organization_id)
        .maybeSingle();

      if (error) throw error;

      return data?.default_country_code || DEFAULT_COUNTRY_DIAL_CODE;
    },
  });

  const resolvedCountryCode = defaultCountryCode || DEFAULT_COUNTRY_DIAL_CODE;
  const countryOption = getCountryPhoneOption(resolvedCountryCode);

  return {
    defaultCountryCode: resolvedCountryCode,
    countryOption,
    phonePlaceholder: getPhonePlaceholder(resolvedCountryCode),
    phoneValidationMessage: getPhoneValidationMessage(resolvedCountryCode),
    phoneFormattingHint: getPhoneFormattingHint(resolvedCountryCode),
  };
}
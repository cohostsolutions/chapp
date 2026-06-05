export interface CountryPhoneOption {
  value: string;
  label: string;
  country: string;
  iso2: string;
  exampleInternational: string;
  exampleLocal: string;
  minLength: number;
  maxLength: number;
  trunkPrefix?: string;
  nationalPattern?: RegExp;
}

export const DEFAULT_COUNTRY_DIAL_CODE = '+1';

export const COUNTRY_PHONE_OPTIONS: CountryPhoneOption[] = [
  {
    value: '+63',
    label: 'Philippines (+63)',
    country: '🇵🇭',
    iso2: 'PH',
    exampleInternational: '+63 912 345 6789',
    exampleLocal: '0912 345 6789',
    minLength: 10,
    maxLength: 10,
    trunkPrefix: '0',
    nationalPattern: /^9\d{9}$/,
  },
  {
    value: '+1',
    label: 'US/Canada (+1)',
    country: '🇺🇸',
    iso2: 'US',
    exampleInternational: '+1 201 555 0123',
    exampleLocal: '201 555 0123',
    minLength: 10,
    maxLength: 10,
    nationalPattern: /^[2-9]\d{9}$/,
  },
  {
    value: '+44',
    label: 'UK (+44)',
    country: '🇬🇧',
    iso2: 'GB',
    exampleInternational: '+44 7700 900123',
    exampleLocal: '07700 900123',
    minLength: 9,
    maxLength: 10,
    trunkPrefix: '0',
  },
  {
    value: '+61',
    label: 'Australia (+61)',
    country: '🇦🇺',
    iso2: 'AU',
    exampleInternational: '+61 412 345 678',
    exampleLocal: '0412 345 678',
    minLength: 9,
    maxLength: 9,
    trunkPrefix: '0',
  },
  {
    value: '+65',
    label: 'Singapore (+65)',
    country: '🇸🇬',
    iso2: 'SG',
    exampleInternational: '+65 8123 4567',
    exampleLocal: '8123 4567',
    minLength: 8,
    maxLength: 8,
  },
  {
    value: '+81',
    label: 'Japan (+81)',
    country: '🇯🇵',
    iso2: 'JP',
    exampleInternational: '+81 90 1234 5678',
    exampleLocal: '090 1234 5678',
    minLength: 9,
    maxLength: 10,
    trunkPrefix: '0',
  },
  {
    value: '+82',
    label: 'South Korea (+82)',
    country: '🇰🇷',
    iso2: 'KR',
    exampleInternational: '+82 10 1234 5678',
    exampleLocal: '010 1234 5678',
    minLength: 9,
    maxLength: 10,
    trunkPrefix: '0',
  },
  {
    value: '+86',
    label: 'China (+86)',
    country: '🇨🇳',
    iso2: 'CN',
    exampleInternational: '+86 138 0013 8000',
    exampleLocal: '138 0013 8000',
    minLength: 11,
    maxLength: 11,
  },
  {
    value: '+852',
    label: 'Hong Kong (+852)',
    country: '🇭🇰',
    iso2: 'HK',
    exampleInternational: '+852 9123 4567',
    exampleLocal: '9123 4567',
    minLength: 8,
    maxLength: 8,
  },
  {
    value: '+60',
    label: 'Malaysia (+60)',
    country: '🇲🇾',
    iso2: 'MY',
    exampleInternational: '+60 12 345 6789',
    exampleLocal: '012 345 6789',
    minLength: 8,
    maxLength: 10,
    trunkPrefix: '0',
  },
  {
    value: '+66',
    label: 'Thailand (+66)',
    country: '🇹🇭',
    iso2: 'TH',
    exampleInternational: '+66 81 234 5678',
    exampleLocal: '081 234 5678',
    minLength: 9,
    maxLength: 9,
    trunkPrefix: '0',
  },
  {
    value: '+62',
    label: 'Indonesia (+62)',
    country: '🇮🇩',
    iso2: 'ID',
    exampleInternational: '+62 812 3456 7890',
    exampleLocal: '0812 3456 7890',
    minLength: 9,
    maxLength: 12,
    trunkPrefix: '0',
  },
  {
    value: '+84',
    label: 'Vietnam (+84)',
    country: '🇻🇳',
    iso2: 'VN',
    exampleInternational: '+84 91 234 5678',
    exampleLocal: '091 234 5678',
    minLength: 9,
    maxLength: 10,
    trunkPrefix: '0',
  },
  {
    value: '+91',
    label: 'India (+91)',
    country: '🇮🇳',
    iso2: 'IN',
    exampleInternational: '+91 98765 43210',
    exampleLocal: '098765 43210',
    minLength: 10,
    maxLength: 10,
    trunkPrefix: '0',
  },
  {
    value: '+971',
    label: 'UAE (+971)',
    country: '🇦🇪',
    iso2: 'AE',
    exampleInternational: '+971 50 123 4567',
    exampleLocal: '050 123 4567',
    minLength: 9,
    maxLength: 9,
    trunkPrefix: '0',
  },
  {
    value: '+49',
    label: 'Germany (+49)',
    country: '🇩🇪',
    iso2: 'DE',
    exampleInternational: '+49 1512 3456789',
    exampleLocal: '01512 3456789',
    minLength: 10,
    maxLength: 11,
    trunkPrefix: '0',
  },
  {
    value: '+33',
    label: 'France (+33)',
    country: '🇫🇷',
    iso2: 'FR',
    exampleInternational: '+33 6 12 34 56 78',
    exampleLocal: '06 12 34 56 78',
    minLength: 9,
    maxLength: 9,
    trunkPrefix: '0',
  },
];

const sortedCountryOptions = [...COUNTRY_PHONE_OPTIONS].sort((left, right) => right.value.length - left.value.length);

export function getCountryPhoneOption(dialCode?: string | null): CountryPhoneOption {
  return COUNTRY_PHONE_OPTIONS.find((option) => option.value === dialCode)
    || COUNTRY_PHONE_OPTIONS.find((option) => option.value === DEFAULT_COUNTRY_DIAL_CODE)
    || COUNTRY_PHONE_OPTIONS[0];
}

export function getCountryPhoneOptionFromNumber(phone: string): CountryPhoneOption | undefined {
  return sortedCountryOptions.find((option) => phone.startsWith(option.value));
}

export function normalizePhoneNumber(phone: string | null | undefined, defaultDialCode: string = DEFAULT_COUNTRY_DIAL_CODE): string {
  if (!phone) return '';

  const trimmed = phone.trim();
  if (!trimmed) return '';

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return trimmed;

  if (trimmed.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  if (trimmed.startsWith('00')) {
    return `+${digitsOnly.slice(2)}`;
  }

  const countryOption = getCountryPhoneOption(defaultDialCode);
  const dialDigits = countryOption.value.replace('+', '');
  let nationalNumber = digitsOnly;

  if (nationalNumber.startsWith(dialDigits)) {
    nationalNumber = nationalNumber.slice(dialDigits.length);
  }

  if (countryOption.trunkPrefix && nationalNumber.startsWith(countryOption.trunkPrefix)) {
    nationalNumber = nationalNumber.slice(countryOption.trunkPrefix.length);
  }

  return `+${dialDigits}${nationalNumber}`;
}

export function isValidPhoneNumber(phone: string | null | undefined, defaultDialCode: string = DEFAULT_COUNTRY_DIAL_CODE): boolean {
  if (!phone?.trim()) return false;

  const normalizedPhone = normalizePhoneNumber(phone, defaultDialCode);
  if (!/^\+\d{8,15}$/.test(normalizedPhone)) {
    return false;
  }

  const countryOption = getCountryPhoneOptionFromNumber(normalizedPhone);
  if (!countryOption) {
    return true;
  }

  const nationalNumber = normalizedPhone.slice(countryOption.value.length);
  if (nationalNumber.length < countryOption.minLength || nationalNumber.length > countryOption.maxLength) {
    return false;
  }

  if (countryOption.nationalPattern && !countryOption.nationalPattern.test(nationalNumber)) {
    return false;
  }

  return true;
}

export function getPhonePlaceholder(dialCode?: string | null): string {
  return getCountryPhoneOption(dialCode).exampleInternational;
}

export function getPhoneValidationMessage(dialCode?: string | null): string {
  return `Invalid phone number. Example: ${getPhonePlaceholder(dialCode)}`;
}

export function getPhoneFormattingHint(dialCode?: string | null): string {
  const countryOption = getCountryPhoneOption(dialCode);
  return `Used for formatting local phone numbers (e.g., ${countryOption.exampleLocal} becomes ${countryOption.exampleInternational})`;
}
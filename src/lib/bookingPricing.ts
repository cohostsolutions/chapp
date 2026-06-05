import { differenceInDays, parseISO, format } from 'date-fns';

export interface PricingTier {
  guests: number;
  price: number;
}

export interface StayDiscount {
  min_nights: number;
  discount_percent: number;
}

export interface RoomPricingConfig {
  pricing_tiers: PricingTier[];
  stay_discounts: StayDiscount[];
}

export interface DynamicPricingSuggestion {
  basePrice: number;
  suggestedPrice: number;
  occupancyRate: number;
  occupancyMultiplier: number;
  seasonalMultiplier: number;
  locationMultiplier: number;
  totalMultiplier: number;
  adjustmentReason: string;
  marketPositioning: string;
  locationSummary?: string;
}

export interface PricingLocationContext {
  propertyName?: string | null;
  propertyDescription?: string | null;
  addressLine1?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

export interface PricingLocationOverrides {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
}

export interface PricingMarketProfile {
  scope: 'country' | 'region' | 'city' | 'district';
  country?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  multiplier: number;
  marketPositioning: string;
  adjustmentLabel: string;
  isActive?: boolean;
  displayOrder?: number;
}

interface LocationPricingSignal {
  multiplier: number;
  marketPositioning: string;
  locationSummary?: string;
  adjustmentLabel?: string;
}

interface MarketProfile {
  aliases: string[];
  multiplier: number;
  marketPositioning: string;
  adjustmentLabel: string;
}

const DISTRICT_MARKET_PROFILES: MarketProfile[] = [
  {
    aliases: ['bonifacio global city', 'bgc', 'makati cbd', 'ayala center', 'ortigas center', 'cebu it park', 'cebu business park', 'marina bay', 'orchard road', 'shibuya', 'ginza', 'downtown dubai', 'business bay', 'dubai marina'],
    multiplier: 1.18,
    marketPositioning: 'Prime district market',
    adjustmentLabel: 'prime district premium',
  },
  {
    aliases: ['sentosa', 'mactan island', 'station 1', 'cloud 9', 'corong corong', 'palm jumeirah', 'tagaytay highlands'],
    multiplier: 1.15,
    marketPositioning: 'Luxury leisure district',
    adjustmentLabel: 'luxury district premium',
  },
  {
    aliases: ['poblacion', 'rockwell center', 'newport city', 'mall of asia complex', 'clarke quay', 'sukhumvit', 'silom'],
    multiplier: 1.1,
    marketPositioning: 'High-traffic lifestyle district',
    adjustmentLabel: 'lifestyle district demand',
  },
];

const CITY_MARKET_PROFILES: MarketProfile[] = [
  {
    aliases: ['new york', 'manhattan', 'london', 'paris', 'singapore', 'tokyo', 'dubai', 'hong kong', 'zurich', 'geneva'],
    multiplier: 1.24,
    marketPositioning: 'Premium global urban market',
    adjustmentLabel: 'premium city market',
  },
  {
    aliases: ['san francisco', 'los angeles', 'miami', 'chicago', 'seattle', 'sydney', 'melbourne', 'toronto', 'vancouver', 'boston', 'washington', 'austin', 'bangkok', 'singapore cbd'],
    multiplier: 1.14,
    marketPositioning: 'Premium metro market',
    adjustmentLabel: 'metro market premium',
  },
  {
    aliases: ['makati', 'taguig', 'bonifacio global city', 'bgc', 'ortigas', 'pasay', 'paranaque', 'parañaque', 'manila bay'],
    multiplier: 1.12,
    marketPositioning: 'Premium business district market',
    adjustmentLabel: 'business district premium',
  },
  {
    aliases: ['cebu city', 'cebu', 'quezon city', 'pasig', 'mandaluyong', 'manila', 'lapu-lapu city', 'lapu lapu city', 'mandaue', 'mandaue city'],
    multiplier: 1.08,
    marketPositioning: 'High-demand urban market',
    adjustmentLabel: 'high-demand city market',
  },
  {
    aliases: ['boracay', 'el nido', 'coron', 'siargao', 'puerto princesa', 'bali', 'phuket', 'maldives', 'aspen', 'tagaytay', 'baguio', 'puerto galera'],
    multiplier: 1.12,
    marketPositioning: 'Destination resort market',
    adjustmentLabel: 'destination city demand',
  },
  {
    aliases: ['davao city', 'davao', 'iloilo city', 'iloilo', 'bacolod', 'cagayan de oro', 'cagayan de oro city', 'dumaguete', 'general santos', 'zamboanga'],
    multiplier: 1.03,
    marketPositioning: 'Regional growth city market',
    adjustmentLabel: 'regional city demand',
  },
];

/**
 * Calculate the total booking price based on room pricing tiers and length-of-stay discounts
 * 
 * @param checkIn - Check-in date string (YYYY-MM-DD)
 * @param checkOut - Check-out date string (YYYY-MM-DD)
 * @param guestCount - Number of guests
 * @param roomPricing - Room pricing configuration with tiers and discounts
 * @returns Total price for the booking, or null if no pricing configured
 */
export function calculateBookingPrice(
  checkIn: string,
  checkOut: string,
  guestCount: number,
  roomPricing: RoomPricingConfig | null
): number | null {
  if (!roomPricing || !roomPricing.pricing_tiers || roomPricing.pricing_tiers.length === 0) {
    return null;
  }

  const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn));
  if (nights <= 0) return null;

  // Find the applicable pricing tier based on guest count
  // Sort tiers by guests descending and find the first one that matches
  const sortedTiers = [...roomPricing.pricing_tiers].sort((a, b) => b.guests - a.guests);
  const applicableTier = sortedTiers.find(tier => guestCount >= tier.guests) || sortedTiers[sortedTiers.length - 1];

  if (!applicableTier) return null;

  const pricePerNight = applicableTier.price;
  let totalPrice = pricePerNight * nights;

  // Apply length-of-stay discount if applicable
  if (roomPricing.stay_discounts && roomPricing.stay_discounts.length > 0) {
    // Sort discounts by min_nights descending and find the best applicable discount
    const sortedDiscounts = [...roomPricing.stay_discounts].sort((a, b) => b.min_nights - a.min_nights);
    const applicableDiscount = sortedDiscounts.find(discount => nights >= discount.min_nights);

    if (applicableDiscount && applicableDiscount.discount_percent > 0) {
      const discountAmount = totalPrice * (applicableDiscount.discount_percent / 100);
      totalPrice = totalPrice - discountAmount;
    }
  }

  return Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
}

/**
 * Format pricing breakdown for display
 */
export function getPricingBreakdown(
  checkIn: string,
  checkOut: string,
  guestCount: number,
  roomPricing: RoomPricingConfig | null
): {
  nights: number;
  pricePerNight: number | null;
  subtotal: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  totalPrice: number | null;
} | null {
  if (!roomPricing || !roomPricing.pricing_tiers || roomPricing.pricing_tiers.length === 0) {
    return null;
  }

  const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn));
  if (nights <= 0) return null;

  const sortedTiers = [...roomPricing.pricing_tiers].sort((a, b) => b.guests - a.guests);
  const applicableTier = sortedTiers.find(tier => guestCount >= tier.guests) || sortedTiers[sortedTiers.length - 1];

  if (!applicableTier) return null;

  const pricePerNight = applicableTier.price;
  const subtotal = pricePerNight * nights;

  let discountPercent: number | null = null;
  let discountAmount: number | null = null;
  let totalPrice = subtotal;

  if (roomPricing.stay_discounts && roomPricing.stay_discounts.length > 0) {
    const sortedDiscounts = [...roomPricing.stay_discounts].sort((a, b) => b.min_nights - a.min_nights);
    const applicableDiscount = sortedDiscounts.find(discount => nights >= discount.min_nights);

    if (applicableDiscount && applicableDiscount.discount_percent > 0) {
      discountPercent = applicableDiscount.discount_percent;
      discountAmount = subtotal * (discountPercent / 100);
      totalPrice = subtotal - discountAmount;
    }
  }

  return {
    nights,
    pricePerNight,
    subtotal,
    discountPercent,
    discountAmount: discountAmount ? Math.round(discountAmount * 100) / 100 : null,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
}

/**
 * Calculate occupancy rate for a date range based on existing bookings
 */
function calculateOccupancyRate(
  checkIn: string,
  checkOut: string,
  existingBookings: Array<{ check_in: string; check_out: string; status: string }>,
  totalRooms: number
): number {
  if (totalRooms === 0) return 0;

  const startDate = parseISO(checkIn);
  const endDate = parseISO(checkOut);
  const totalNights = differenceInDays(endDate, startDate);
  
  if (totalNights <= 0) return 0;

  // Count booked nights in the date range
  let bookedNightCount = 0;
  const bookingWeights: Record<string, number> = {
    checked_in: 1,
    confirmed: 1,
    upcoming: 1,
    pending: 0.6,
  };
  
  for (const booking of existingBookings) {
    const bookingWeight = bookingWeights[booking.status] ?? 0;
    if (bookingWeight === 0) {
      continue;
    }

    const bookingStart = parseISO(booking.check_in);
    const bookingEnd = parseISO(booking.check_out);

    // Check if booking overlaps with the requested date range
    const overlapStart = bookingStart < startDate ? startDate : bookingStart;
    const overlapEnd = bookingEnd > endDate ? endDate : bookingEnd;

    if (overlapStart < overlapEnd) {
      const overlapNights = differenceInDays(overlapEnd, overlapStart);
      bookedNightCount += overlapNights * bookingWeight;
    }
  }

  const totalAvailableNights = totalNights * totalRooms;
  const occupancyRate = (bookedNightCount / totalAvailableNights) * 100;
  
  return Math.min(Math.round(occupancyRate * 10) / 10, 100); // Round to 1 decimal, cap at 100%
}

/**
 * Calculate seasonal multiplier based on month (simple version)
 * Peak season (Jun-Aug, Dec): 1.15
 * Shoulder season (Apr-May, Sep-Oct): 1.05
 * Low season (Jan-Mar, Nov): 0.95
 */
function getSeasonalMultiplier(checkIn: string): number {
  const date = parseISO(checkIn);
  const month = date.getMonth(); // 0-11

  // Peak season: June (5), July (6), August (7), December (11)
  if ([5, 6, 7, 11].includes(month)) {
    return 1.15;
  }

  // Shoulder season: April (3), May (4), September (8), October (9)
  if ([3, 4, 8, 9].includes(month)) {
    return 1.05;
  }

  // Low season: January (0), February (1), March (2), November (10)
  return 0.95;
}

function normalizeLocationText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function buildLocationSearchText(location?: PricingLocationContext | null): string {
  return [
    location?.propertyName,
    location?.propertyDescription,
    location?.addressLine1,
    location?.district,
    location?.city,
    location?.state,
    location?.region,
    location?.country,
    location?.postalCode,
  ]
    .map(normalizeLocationText)
    .filter(Boolean)
    .join(' | ');
}

function pickLocationSummary(location?: PricingLocationContext | null): string | undefined {
  if (!location) return undefined;

  const locality = [location.district, location.city, location.state || location.region, location.country]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');

  if (locality) {
    return locality;
  }

  const propertyName = location.propertyName?.trim();
  return propertyName || undefined;
}

function getNormalizedLocationCandidates(location?: PricingLocationContext | null): string[] {
  if (!location) {
    return [];
  }

  return [location.district, location.city, location.state, location.region]
    .map(normalizeLocationText)
    .filter(Boolean);
}

function matchesLocationAlias(candidate: string, alias: string): boolean {
  return candidate === alias || candidate.includes(alias) || alias.includes(candidate);
}

function matchesStructuredLocation(location: PricingLocationContext | null | undefined, profile: PricingMarketProfile): boolean {
  if (!location) {
    return false;
  }

  const comparisons: Array<[string | null | undefined, string | null | undefined]> = [
    [location.country, profile.country],
    [location.region || location.state, profile.region],
    [location.city, profile.city],
    [location.district, profile.district],
  ];

  return comparisons.every(([actual, expected]) => {
    if (!expected) {
      return true;
    }

    return normalizeLocationText(actual) === normalizeLocationText(expected);
  });
}

function getCustomPricingSignal(
  location?: PricingLocationContext | null,
  marketProfiles: PricingMarketProfile[] = []
): LocationPricingSignal | null {
  const locationSummary = pickLocationSummary(location);
  const sortedProfiles = [...marketProfiles]
    .filter((profile) => profile.isActive !== false)
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));

  const profile = sortedProfiles.find((candidate) => matchesStructuredLocation(location, candidate));

  if (!profile) {
    return null;
  }

  return {
    multiplier: profile.multiplier,
    marketPositioning: profile.marketPositioning,
    locationSummary,
    adjustmentLabel: `${profile.adjustmentLabel}${locationSummary ? ` in ${locationSummary}` : ''}`,
  };
}

function getMarketPricingSignal(
  profiles: MarketProfile[],
  location?: PricingLocationContext | null
): LocationPricingSignal | null {
  const locationSummary = pickLocationSummary(location);
  const candidates = getNormalizedLocationCandidates(location);

  if (candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const profile = profiles.find((marketProfile) =>
      marketProfile.aliases.some((alias) => matchesLocationAlias(candidate, alias))
    );

    if (profile) {
      return {
        multiplier: profile.multiplier,
        marketPositioning: profile.marketPositioning,
        locationSummary,
        adjustmentLabel: `${profile.adjustmentLabel}${locationSummary ? ` in ${locationSummary}` : ''}`,
      };
    }
  }

  return null;
}

function getLocationPricingSignal(location?: PricingLocationContext | null): LocationPricingSignal {
  return getLocationPricingSignalWithProfiles(location, []);
}

function getLocationPricingSignalWithProfiles(
  location?: PricingLocationContext | null,
  marketProfiles: PricingMarketProfile[] = []
): LocationPricingSignal {
  const locationSummary = pickLocationSummary(location);
  const customSignal = getCustomPricingSignal(location, marketProfiles);

  if (customSignal) {
    return customSignal;
  }

  const districtSignal = getMarketPricingSignal(DISTRICT_MARKET_PROFILES, location);

  if (districtSignal) {
    return districtSignal;
  }

  const citySignal = getMarketPricingSignal(CITY_MARKET_PROFILES, location);

  if (citySignal) {
    return citySignal;
  }

  const searchText = buildLocationSearchText(location);

  if (!searchText) {
    return {
      multiplier: 1,
      marketPositioning: 'Standard local market',
      locationSummary,
    };
  }

  const resortMarkets = [
    'beach',
    'beachfront',
    'island',
    'coast',
    'resort',
    'waterfront',
    'mountain',
    'ski',
    'maldives',
    'bali',
    'boracay',
    'palawan',
    'aspen',
    'phuket',
  ];
  const urbanBusinessMarkets = [
    'downtown',
    'central business district',
    'business district',
    'city center',
    'financial district',
    'airport',
  ];
  const valueMarkets = [
    'suburb',
    'suburban',
    'province',
    'provincial',
    'rural',
    'countryside',
    'inland',
  ];

  if (resortMarkets.some((market) => searchText.includes(market))) {
    return {
      multiplier: 1.12,
      marketPositioning: 'Destination resort market',
      locationSummary,
      adjustmentLabel: `destination resort demand${locationSummary ? ` in ${locationSummary}` : ''}`,
    };
  }

  if (urbanBusinessMarkets.some((market) => searchText.includes(market))) {
    return {
      multiplier: 1.08,
      marketPositioning: 'Urban business market',
      locationSummary,
      adjustmentLabel: `urban location premium${locationSummary ? ` in ${locationSummary}` : ''}`,
    };
  }

  if (valueMarkets.some((market) => searchText.includes(market))) {
    return {
      multiplier: 0.94,
      marketPositioning: 'Value-oriented regional market',
      locationSummary,
      adjustmentLabel: `value-sensitive regional market${locationSummary ? ` in ${locationSummary}` : ''}`,
    };
  }

  return {
    multiplier: 1,
    marketPositioning: 'Standard local market',
    locationSummary,
  };
}

export function getPropertyPricingContext(
  property?: PricingLocationContext | null,
  overrides?: PricingLocationOverrides | null
): PricingLocationContext | null {
  if (!property && !overrides) {
    return null;
  }

  return {
    propertyName: property?.propertyName,
    propertyDescription: property?.propertyDescription,
    addressLine1: property?.addressLine1,
    district: overrides?.district,
    country: overrides?.country ?? property?.country,
    region: overrides?.region ?? property?.region,
    city: overrides?.city ?? property?.city,
    state: property?.state,
    postalCode: property?.postalCode,
  };
}

/**
 * Calculate dynamic pricing suggestion based on occupancy and seasonality
 */
export function calculateDynamicPricing(
  checkIn: string,
  checkOut: string,
  guestCount: number,
  roomPricing: RoomPricingConfig | null,
  existingBookings: Array<{ check_in: string; check_out: string; status: string }>,
  totalRooms: number,
  location?: PricingLocationContext | null,
  marketProfiles: PricingMarketProfile[] = []
): DynamicPricingSuggestion | null {
  // Calculate base price
  const basePrice = calculateBookingPrice(checkIn, checkOut, guestCount, roomPricing);
  
  if (basePrice === null) {
    return null;
  }

  // Calculate occupancy rate for the date range
  const occupancyRate = calculateOccupancyRate(checkIn, checkOut, existingBookings, totalRooms);

  // Determine occupancy multiplier
  let occupancyMultiplier = 1.0;
  let occupancyReason = 'Normal demand';

  if (occupancyRate >= 80) {
    occupancyMultiplier = 1.20; // +20% for high occupancy
    occupancyReason = 'High demand';
  } else if (occupancyRate >= 50) {
    occupancyMultiplier = 1.10; // +10% for medium occupancy
    occupancyReason = 'Moderate demand';
  } else if (occupancyRate < 30) {
    occupancyMultiplier = 0.90; // -10% for low occupancy
    occupancyReason = 'Low demand - discount';
  }

  // Calculate seasonal multiplier
  const seasonalMultiplier = getSeasonalMultiplier(checkIn);
  const seasonName = format(parseISO(checkIn), 'MMMM');
  let seasonReason = '';

  if (seasonalMultiplier > 1.0) {
    seasonReason = ` + peak season (${seasonName})`;
  } else if (seasonalMultiplier < 1.0) {
    seasonReason = ` + off-season (${seasonName})`;
  }

  const locationSignal = getLocationPricingSignalWithProfiles(location, marketProfiles);

  // Calculate total multiplier and suggested price
  const totalMultiplier = occupancyMultiplier * seasonalMultiplier * locationSignal.multiplier;
  const suggestedPrice = Math.round(basePrice * totalMultiplier);

  const adjustmentReason = `${occupancyReason}${seasonReason}${locationSignal.adjustmentLabel ? ` + ${locationSignal.adjustmentLabel}` : ''}`;

  return {
    basePrice,
    suggestedPrice,
    occupancyRate,
    occupancyMultiplier,
    seasonalMultiplier,
    locationMultiplier: locationSignal.multiplier,
    totalMultiplier,
    adjustmentReason,
    marketPositioning: locationSignal.marketPositioning,
    locationSummary: locationSignal.locationSummary,
  };
}

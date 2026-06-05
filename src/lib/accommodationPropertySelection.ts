export interface AccommodationPropertyOption {
  id: string;
}

export function getAccommodationWritePropertyId(
  selectedPropertyId: string,
  properties: AccommodationPropertyOption[]
): string | null {
  if (selectedPropertyId !== 'all') {
    if (!properties.some((property) => property.id === selectedPropertyId)) {
      return null;
    }

    return selectedPropertyId;
  }

  return properties.length === 1 ? properties[0].id : null;
}

export function requiresAccommodationPropertySelection(
  selectedPropertyId: string,
  properties: AccommodationPropertyOption[]
): boolean {
  return selectedPropertyId === 'all' && properties.length > 1;
}

export function normalizeAccommodationSelectedPropertyId(
  selectedPropertyId: string,
  properties: AccommodationPropertyOption[]
): string {
  if (selectedPropertyId === 'all') {
    return 'all';
  }

  return properties.some((property) => property.id === selectedPropertyId)
    ? selectedPropertyId
    : 'all';
}
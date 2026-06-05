import { FormFieldConfig } from './GenericFormDialog';

/**
 * Booking form field configuration for Accommodation/Cece organizations
 */
export const BOOKING_FORM_FIELDS: FormFieldConfig[] = [
  {
    name: 'guestName',
    label: 'Guest Name',
    placeholder: 'Enter guest name',
    type: 'text',
    required: true,
  },
  {
    name: 'checkIn',
    label: 'Check-in Date',
    type: 'date',
    required: true,
  },
  {
    name: 'checkOut',
    label: 'Check-out Date',
    type: 'date',
    required: true,
    description: 'Must be after check-in date',
  },
  {
    name: 'roomId',
    label: 'Room',
    type: 'select',
    placeholder: 'Select a room',
    required: true,
    // selectOptions will be populated dynamically
  },
  {
    name: 'guestCount',
    label: 'Number of Guests',
    type: 'number',
    required: true,
    min: 1,
    max: 20,
  },
  {
    name: 'specialRequests',
    label: 'Special Requests',
    placeholder: 'Any special accommodations?',
    type: 'textarea',
  },
];

/**
 * Order form field configuration for Food/May organizations
 */
export const ORDER_FORM_FIELDS: FormFieldConfig[] = [
  {
    name: 'customerName',
    label: 'Customer Name',
    placeholder: 'Enter customer name',
    type: 'text',
    required: true,
  },
  {
    name: 'items',
    label: 'Select Menu Items',
    type: 'multi-select',
    placeholder: 'Select items for the order',
    required: true,
    // selectOptions will be populated dynamically from menu items
  },
  {
    name: 'pickupTime',
    label: 'Pickup Time (Optional)',
    type: 'datetime-local',
  },
  {
    name: 'deliveryAddress',
    label: 'Delivery Address (Optional)',
    placeholder: 'If delivery needed',
    type: 'text',
  },
  {
    name: 'specialInstructions',
    label: 'Special Instructions',
    placeholder: 'Any dietary restrictions or notes?',
    type: 'textarea',
  },
];

/**
 * Sale form field configuration for Sales/Jay organizations
 */
export const SALE_FORM_FIELDS: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Sales Lead Name',
    placeholder: 'Enter lead name',
    type: 'text',
    required: true,
  },
  {
    name: 'temperature',
    label: 'Lead Temperature',
    type: 'select',
    required: true,
    selectOptions: [
      { value: 'cold', label: '❄️ Cold' },
      { value: 'warm', label: '🔥 Warm' },
      { value: 'hot', label: '🌡️ Hot' },
    ],
  },
  {
    name: 'selectedOfferings',
    label: 'Offerings',
    type: 'multi-select',
    placeholder: 'Select offerings for this lead',
    // selectOptions will be populated dynamically from offerings
  },
  {
    name: 'notes',
    label: 'Notes',
    placeholder: 'Any additional information?',
    type: 'textarea',
  },
];

/**
 * Helper function to get form fields with dynamic options populated
 */
export function getFormFieldsWithOptions(
  baseFields: FormFieldConfig[],
  fieldName: string,
  options: Array<{ value: string; label: string }>
): FormFieldConfig[] {
  return baseFields.map((field) => {
    if (field.name === fieldName) {
      return {
        ...field,
        selectOptions: options,
      };
    }
    return field;
  });
}

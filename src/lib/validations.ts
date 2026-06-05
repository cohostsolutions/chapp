import { z } from 'zod';
import {
  DEFAULT_COUNTRY_DIAL_CODE,
  getPhoneValidationMessage,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '@/lib/phone';

// Email validation schema
export const emailSchema = z.string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" })
  .or(z.literal(''));

export const createPhoneSchema = (defaultCountryCode: string = DEFAULT_COUNTRY_DIAL_CODE) => z.string()
  .trim()
  .refine((val) => val === '' || isValidPhoneNumber(val, defaultCountryCode), {
    message: getPhoneValidationMessage(defaultCountryCode),
  })
  .or(z.literal(''));

export const createOptionalPhoneSchema = (defaultCountryCode: string = DEFAULT_COUNTRY_DIAL_CODE) => z.string()
  .trim()
  .refine((val) => val === '' || isValidPhoneNumber(val, defaultCountryCode), {
    message: getPhoneValidationMessage(defaultCountryCode),
  })
  .optional()
  .or(z.literal(''));

// Generic default schemas for places without organization context.
export const phoneSchema = createPhoneSchema();
export const optionalPhoneSchema = createOptionalPhoneSchema();

// Optional email validation
export const optionalEmailSchema = z.string()
  .trim()
  .refine((val) => val === '' || z.string().email().safeParse(val).success, {
    message: "Invalid email address"
  })
  .optional()
  .or(z.literal(''));

// ==================== NUMERIC VALIDATION (PRICES, AMOUNTS) ====================

// Price validation schema - prevents negative values and enforces reasonable limits
export const priceSchema = z.number()
  .finite({ message: "Price must be a valid number" })
  .min(0, { message: "Price cannot be negative" })
  .max(99999999, { message: "Price exceeds the maximum allowed value" });

// Amount validation schema - for expenses, payments, etc
export const amountSchema = z.number()
  .finite({ message: "Amount must be a valid number" })
  .min(0, { message: "Amount cannot be negative" })
  .max(99999999, { message: "Amount exceeds the maximum allowed value" });

// Quantity validation - must be positive integer
export const quantitySchema = z.number()
  .int({ message: "Quantity must be a whole number" })
  .min(1, { message: "Quantity must be at least 1" })
  .max(100000, { message: "Quantity exceeds maximum limit" });

// Percentage validation - 0 to 100
export const percentageSchema = z.number()
  .min(0, { message: "Percentage cannot be negative" })
  .max(100, { message: "Percentage cannot exceed 100" });

// Legacy alias kept for compatibility while the codebase migrates.
export function normalizePhoneToPH(phone: string | null | undefined, defaultCode = DEFAULT_COUNTRY_DIAL_CODE): string {
  return normalizePhoneNumber(phone, defaultCode);
}

// Lead validation schema
export const createLeadSchema = (defaultCountryCode: string = DEFAULT_COUNTRY_DIAL_CODE) => z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z.string()
    .trim()
    .refine((val) => val === '' || z.string().email().safeParse(val).success, {
      message: "Invalid email address"
    })
    .optional()
    .or(z.literal('')),
  phone: createOptionalPhoneSchema(defaultCountryCode),
  source: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(2000, { message: "Notes must be less than 2000 characters" }).optional().or(z.literal('')),
});

export const leadSchema = createLeadSchema();

export type LeadFormData = z.infer<typeof leadSchema>;

// Lead import row validation (more lenient for batch imports)
export const leadImportRowSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(100),
  email: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  source: z.string().trim().max(50).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

// Social platform credentials validation
export const socialPlatformCredentialsSchema = z.object({
  page_id: z.string().trim().max(100).optional(),
  page_access_token: z.string().trim().max(500).optional(),
  phone_number_id: z.string().trim().max(100).optional(),
  access_token: z.string().trim().max(500).optional(),
  business_account_id: z.string().trim().max(100).optional(),
  instagram_account_id: z.string().trim().max(100).optional(),
});

// Generic message validation for edge functions
export const messageSchema = z.object({
  message: z.string()
    .trim()
    .min(1, { message: "Message cannot be empty" })
    .max(5000, { message: "Message must be less than 5000 characters" }),
  leadId: z.string().uuid({ message: "Invalid lead ID" }).optional(),
  conversationId: z.string().uuid({ message: "Invalid conversation ID" }).optional(),
});

// ==================== BOOKING VALIDATION (CECE - HOSPITALITY) ====================

// Booking creation schema
export const createBookingSchema = (defaultCountryCode: string = DEFAULT_COUNTRY_DIAL_CODE) => z.object({
  guestName: z.string()
    .trim()
    .min(2, { message: "Guest name must be at least 2 characters" })
    .max(100, { message: "Guest name must be less than 100 characters" }),
  guestPhone: createOptionalPhoneSchema(defaultCountryCode),
  guestEmail: z.string()
    .trim()
    .refine((val) => val === '' || z.string().email().safeParse(val).success, {
      message: "Invalid email address"
    })
    .optional()
    .or(z.literal('')),
  checkIn: z.string()
    .min(1, { message: "Check-in date is required" })
    .refine((val) => !isNaN(Date.parse(val)), { message: "Check-in date must be valid" }),
  checkOut: z.string()
    .min(1, { message: "Check-out date is required" })
    .refine((val) => !isNaN(Date.parse(val)), { message: "Check-out date must be valid" }),
  roomId: z.string()
    .uuid({ message: "Invalid room ID" }),
  guestCount: z.number()
    .int({ message: "Guest count must be a whole number" })
    .min(1, { message: "Guest count must be at least 1" })
    .max(20, { message: "Guest count cannot exceed 20" }),
  notes: z.string()
    .max(2000, { message: "Notes must be less than 2000 characters" })
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  {
    message: "Check-out date must be after check-in date",
    path: ["checkOut"],
  }
);

export const bookingSchema = createBookingSchema();

export type BookingFormData = z.infer<typeof bookingSchema>;

// ==================== SALE VALIDATION (JAY - SALES/B2B) ====================

// Sale creation schema
export const createSaleSchema = (defaultCountryCode: string = DEFAULT_COUNTRY_DIAL_CODE) => z.object({
  name: z.string()
    .trim()
    .min(2, { message: "Customer name must be at least 2 characters" })
    .max(100, { message: "Customer name must be less than 100 characters" }),
  phone: createOptionalPhoneSchema(defaultCountryCode),
  email: z.string()
    .trim()
    .refine((val) => val === '' || z.string().email().safeParse(val).success, {
      message: "Invalid email address"
    })
    .optional()
    .or(z.literal('')),
  source: z.string()
    .max(50, { message: "Source must be less than 50 characters" })
    .optional()
    .or(z.literal('')),
  temperature: z.enum(['cold', 'warm', 'hot'], {
    message: "Temperature must be cold, warm, or hot"
  }),
  selectedOfferings: z.array(z.string().uuid())
    .optional()
    .default([]),
  notes: z.string()
    .max(2000, { message: "Notes must be less than 2000 characters" })
    .optional()
    .or(z.literal('')),
});

export const saleSchema = createSaleSchema();

/**
 * Deal value tracking schema - extends sale data with deal-specific fields
 * Note: Requires deal_value and expected_close_date columns on leads table
 */
export const dealValueSchema = z.object({
  dealValue: z.number()
    .positive({ message: "Deal value must be greater than 0" })
    .max(999999999, { message: "Deal value is too large" })
    .optional(),
  expectedCloseDate: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), { message: "Invalid date format" })
    .optional(),
  dealStage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'], {
    message: "Invalid deal stage"
  }).default('prospecting'),
  probability: z.number()
    .min(0, { message: "Probability must be between 0 and 100" })
    .max(100, { message: "Probability must be between 0 and 100" })
    .default(25),
  expectedRevenue: z.number()
    .min(0, { message: "Expected revenue cannot be negative" })
    .optional(),
});

export type SaleFormData = z.infer<typeof saleSchema>;
export type DealValueFormData = z.infer<typeof dealValueSchema>;

/**
 * Guest preferences schema - for storing guest-specific preferences and history
 * Note: Requires guest_preferences table with guest_id, organization_id, previous_stay_notes, preferred_room_types, preferred_configurations, special_requests, created_at, updated_at
 */
export const guestPreferencesSchema = z.object({
  previousStayNotes: z.string()
    .max(2000, { message: "Notes cannot exceed 2000 characters" })
    .optional()
    .or(z.literal('')),
  preferredRoomTypes: z.array(z.string())
    .max(5, { message: "Maximum 5 preferred room types" })
    .optional(),
  preferredConfigurations: z.object({
    bedPreference: z.enum(['single', 'double', 'twin', 'king', 'queen', 'any']).default('any'),
    floorPreference: z.enum(['ground', 'mid', 'top', 'any']).default('any'),
    viewPreference: z.enum(['garden', 'ocean', 'city', 'any']).default('any'),
    quietRoom: z.boolean().default(false),
    nearElevator: z.boolean().default(false),
    accessibilityNeeds: z.boolean().default(false),
  }).optional(),
  specialRequests: z.array(z.object({
    request: z.string().max(500),
    fulfilled: z.boolean().default(false),
  }))
    .max(10, { message: "Maximum 10 special requests" })
    .optional(),
});

export type GuestPreferencesFormData = z.infer<typeof guestPreferencesSchema>;

/**
 * Housekeeping task schema - for managing room cleaning and maintenance tasks
 * Note: Requires housekeeping_tasks table with:
 * - id (uuid, pk)
 * - property_id (uuid, fk to properties)
 * - room_id (uuid, fk to rooms)
 * - organization_id (uuid, fk to organizations)
 * - title (text)
 * - description (text)
 * - priority (enum: low, medium, high, urgent)
 * - status (enum: pending, in_progress, completed, cancelled)
 * - task_type (enum: cleaning, maintenance, inspection, turnover)
 * - assigned_to (uuid, fk to staff)
 * - assigned_at (timestamp)
 * - completed_at (timestamp)
 * - checklist_items (jsonb[])
 * - estimated_duration (integer, minutes)
 * - actual_duration (integer, minutes)
 * - notes (text)
 * - created_at (timestamp)
 * - updated_at (timestamp)
 */
export const housekeepingTaskSchema = z.object({
  title: z.string()
    .min(3, { message: "Task title must be at least 3 characters" })
    .max(255, { message: "Task title cannot exceed 255 characters" }),
  description: z.string()
    .max(2000, { message: "Description cannot exceed 2000 characters" })
    .optional()
    .or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  taskType: z.enum(['cleaning', 'maintenance', 'inspection', 'turnover']).default('cleaning'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  roomId: z.string().uuid('Invalid room ID'),
  assignedTo: z.string().uuid('Invalid staff member').optional(),
  estimatedDuration: z.number()
    .min(5, { message: "Estimated duration must be at least 5 minutes" })
    .max(480, { message: "Estimated duration cannot exceed 8 hours (480 minutes)" })
    .optional(),
  checklistItems: z.array(z.object({
    item: z.string().max(500),
    completed: z.boolean().default(false),
  }))
    .max(20, { message: "Maximum 20 checklist items" })
    .optional(),
  notes: z.string()
    .max(2000, { message: "Notes cannot exceed 2000 characters" })
    .optional()
    .or(z.literal('')),
});

export const roomInspectionSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  inspectionType: z.enum(['pre_checkin', 'post_checkout', 'maintenance', 'deep_clean']).default('post_checkout'),
  overallCondition: z.enum(['excellent', 'good', 'fair', 'poor']),
  issues: z.array(z.object({
    area: z.string().max(255),
    issue: z.string().max(500),
    severity: z.enum(['minor', 'major']),
    resolved: z.boolean().default(false),
  }))
    .optional(),
  notes: z.string()
    .max(2000, { message: "Notes cannot exceed 2000 characters" })
    .optional()
    .or(z.literal('')),
  photos: z.array(z.string().url())
    .max(10, { message: "Maximum 10 photos" })
    .optional(),
});

export type HousekeepingTaskFormData = z.infer<typeof housekeepingTaskSchema>;
export type RoomInspectionFormData = z.infer<typeof roomInspectionSchema>;

// ==================== VALIDATION HELPER FUNCTIONS ====================

// Validate and parse with helpful error messages
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
  return { success: false, errors };
}

import { z } from 'zod';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must not exceed 15 digits')
    .regex(/^\+?[0-9]+$/, 'Phone number must contain only digits and optional + prefix'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
});

// ============================================================================
// CLIENT SCHEMAS
// ============================================================================

export const createClientSchema = z.object({
  companyName: z.string()
    .min(1, 'Company name is required')
    .max(200, 'Company name must not exceed 200 characters'),
  contactPerson: z.string()
    .min(1, 'Contact person is required')
    .max(100, 'Contact person must not exceed 100 characters'),
  email: z.string()
    .email('Invalid email address')
    .max(100, 'Email must not exceed 100 characters'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must not exceed 15 digits'),
  whatsappNumber: z.string()
    .min(10, 'WhatsApp number must be at least 10 digits')
    .max(15, 'WhatsApp number must not exceed 15 digits'),
  customerTier: z.enum(['premium', 'standard', 'basic']),
  paymentTerms: z.enum(['prepaid', 'net15', 'net30']),
  billingAddress: z.string()
    .min(1, 'Billing address is required')
    .max(500, 'Billing address must not exceed 500 characters'),
  shippingAddress: z.string().optional(),
  gstin: z.string().optional(),
  accountManagerId: z.string().uuid().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ============================================================================
// SERVICE REQUEST SCHEMAS
// ============================================================================

export const createServiceRequestSchema = z.object({
  containerId: z.string().uuid('Invalid container ID'),
  issueDescription: z.string()
    .min(1, 'Issue description is required')
    .max(2000, 'Issue description must not exceed 2000 characters'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  reportedBy: z.string().uuid().optional(),
  reportedAt: z.string().datetime().optional(),
});

export const updateServiceRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  assignedTechnicianId: z.string().uuid().optional(),
  scheduledDate: z.string().datetime().optional(),
  resolutionNotes: z.string().max(2000).optional(),
  coordinatorRemarks: z.string().max(2000).optional(),
});

export const assignTechnicianSchema = z.object({
  technicianId: z.string().uuid('Invalid technician ID'),
  estimatedArrival: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// TECHNICIAN SCHEMAS
// ============================================================================

export const createTechnicianSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must not exceed 15 digits'),
  whatsappNumber: z.string()
    .min(10, 'WhatsApp number must be at least 10 digits')
    .max(15, 'WhatsApp number must not exceed 15 digits'),
  skills: z.string().max(500).optional(),
  experienceLevel: z.enum(['junior', 'mid', 'senior']).default('mid'),
  grade: z.string().max(50).optional(),
  designation: z.string().max(100).optional(),
  baseSalary: z.number().min(0).optional(),
  allowances: z.number().min(0).optional(),
  costPerTask: z.number().min(0).optional(),
  status: z.enum(['available', 'busy', 'off_duty']).default('available'),
});

export const updateTechnicianSchema = createTechnicianSchema.partial();

// ============================================================================
// INVENTORY SCHEMAS
// ============================================================================

export const createInventorySchema = z.object({
  partNumber: z.string()
    .min(1, 'Part number is required')
    .max(100, 'Part number must not exceed 100 characters'),
  partName: z.string()
    .min(1, 'Part name is required')
    .max(200, 'Part name must not exceed 200 characters'),
  category: z.string()
    .min(1, 'Category is required')
    .max(50, 'Category must not exceed 50 characters'),
  quantityInStock: z.number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative'),
  reorderLevel: z.number()
    .int('Reorder level must be a whole number')
    .min(0, 'Reorder level cannot be negative'),
  unitPrice: z.number()
    .min(0, 'Unit price cannot be negative'),
  location: z.string()
    .min(1, 'Location is required')
    .max(200, 'Location must not exceed 200 characters'),
  supplier: z.string().max(200).optional(),
});

export const updateInventorySchema = createInventorySchema.partial();

export const adjustStockSchema = z.object({
  quantity: z.number()
    .int('Quantity must be a whole number'),
  reason: z.string()
    .min(1, 'Reason is required')
    .max(500, 'Reason must not exceed 500 characters'),
  transactionType: z.enum(['in', 'out', 'adjustment']),
});

// ============================================================================
// CONTAINER SCHEMAS
// ============================================================================

export const createContainerSchema = z.object({
  containerNumber: z.string()
    .min(1, 'Container number is required')
    .max(50, 'Container number must not exceed 50 characters'),
  type: z.enum(['reefer', 'dry']).default('reefer'),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).default('available'),
  currentCustomerId: z.string().uuid().optional(),
  depot: z.string().max(200).optional(),
  currentLocation: z.object({
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(),
});

export const updateContainerSchema = createContainerSchema.partial();

// ============================================================================
// TRAVEL/TRIP SCHEMAS
// ============================================================================

export const createTripSchema = z.object({
  technicianId: z.string().uuid('Invalid technician ID'),
  destination: z.string()
    .min(1, 'Destination is required')
    .max(200, 'Destination must not exceed 200 characters'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  purpose: z.enum(['pm', 'breakdown', 'audit', 'mixed']),
  estimatedCost: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateTripSchema = createTripSchema.partial();

// ============================================================================
// WHATSAPP SCHEMAS
// ============================================================================

export const sendWhatsAppMessageSchema = z.object({
  to: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must not exceed 15 digits'),
  message: z.string()
    .min(1, 'Message is required')
    .max(4096, 'Message must not exceed 4096 characters'),
  type: z.enum(['text', 'template', 'interactive']).default('text'),
});

export const sendWhatsAppTemplateSchema = z.object({
  to: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must not exceed 15 digits'),
  templateName: z.string().min(1, 'Template name is required'),
  parameters: z.array(z.string()).optional(),
});

// ============================================================================
// UUID PARAM SCHEMA (for :id routes)
// ============================================================================

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

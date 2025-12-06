/**
 * Role-based Access Control Service
 *
 * This module handles access control logic for different user roles:
 * - admin: Complete system access (highest privilege)
 * - senior_technician: Only refrigerated containers (all statuses, all IoT)
 * - amc: Only sold containers, limited to contact info only
 * - technician: Only containers with allocated services
 * - client: Only their assigned containers
 */

import { Container } from "@shared/schema";

export interface RoleAccessFilter {
  role: string;
  allowedStatuses?: string[];
  allowedTypes?: string[];
  requiresIoT?: boolean;
  fieldsRestriction?: 'contact_only' | 'readonly' | 'full';
  assignedOnly?: boolean; // For technician - only assigned service containers
}

/**
 * Get access filter configuration based on user role
 */
export function getRoleAccessFilter(role: string): RoleAccessFilter | null {
  const normalizedRole = role.toLowerCase();

  switch (normalizedRole) {
    case 'admin':
      // Complete system access - no restrictions
      return {
        role: 'admin',
        allowedTypes: undefined, // All container types
        requiresIoT: undefined, // All containers regardless of IoT
        allowedStatuses: undefined, // All statuses
        fieldsRestriction: 'full' // Full access to everything
      };

    case 'senior_technician':
      // Only refrigerated containers, all statuses, all IoT deployment states
      return {
        role: 'senior_technician',
        allowedTypes: ['refrigerated'], // ONLY refrigerated containers
        requiresIoT: undefined, // All reefer containers regardless of IoT
        allowedStatuses: undefined, // All statuses (active, maintenance, sold, etc.)
        fieldsRestriction: 'readonly' // Read-only access to client data
      };

    case 'amc':
      // Only sold containers with limited contact info
      return {
        role: 'amc',
        allowedStatuses: ['sold'], // ONLY sold containers
        allowedTypes: undefined, // All types but only sold status
        fieldsRestriction: 'contact_only' // Very limited - contact info only
      };

    case 'technician':
      // Only containers they have allocated services for
      return {
        role: 'technician',
        assignedOnly: true, // Only containers with assigned services
        fieldsRestriction: 'full' // Full container data but no customer financial data
      };

    default:
      return null; // No special filtering for other roles (client handled separately)
  }
}

/**
 * Check if a container passes the role-based access filter
 */
export function canAccessContainer(container: Container, role: string): boolean {
  const filter = getRoleAccessFilter(role);

  // No filter means full access
  if (!filter) return true;

  // Check status filter
  if (filter.allowedStatuses && !filter.allowedStatuses.includes(container.status)) {
    return false;
  }

  // Check type filter (for senior_technician - reefer containers)
  if (filter.allowedTypes && !filter.allowedTypes.includes(container.type)) {
    return false;
  }

  // Check IoT requirement (for senior_technician - deployed containers)
  if (filter.requiresIoT && !container.hasIot) {
    return false;
  }

  return true;
}

/**
 * Filter an array of containers based on role access
 */
export function filterContainersByRole(containers: Container[], role: string): Container[] {
  const filter = getRoleAccessFilter(role);

  // No filter means return all
  if (!filter) return containers;

  return containers.filter(container => canAccessContainer(container, role));
}

/**
 * Get sanitized container data based on role restrictions
 * For AMC role, only return contact-related fields
 */
export function sanitizeContainerForRole(container: any, role: string): any {
  const filter = getRoleAccessFilter(role);

  // No restrictions for most roles
  if (!filter || filter.fieldsRestriction === 'full') {
    return container;
  }

  // AMC role - only contact details
  if (filter.fieldsRestriction === 'contact_only') {
    return {
      id: container.id,
      containerCode: container.containerCode,
      status: container.status,
      type: container.type,
      currentCustomerId: container.currentCustomerId,
      // Only these fields are allowed for AMC
      manufacturer: container.manufacturer,
      model: container.model,
      capacity: container.capacity,
      currentLocation: container.currentLocation,
      // Remove sensitive data
      healthScore: undefined,
      lastTelemetry: undefined,
      orbcommDeviceId: undefined,
      usageCycles: undefined,
    };
  }

  return container;
}

/**
 * Get sanitized client/customer data based on role
 * - admin: Full access to all customer data including financial info
 * - senior_technician: Read-only contact information
 * - amc: Contact information only
 * - technician: No customer data access
 */
export function sanitizeClientForRole(client: any, role: string): any {
  const filter = getRoleAccessFilter(role);

  // Admin - full access to all customer data
  if (!filter || filter.fieldsRestriction === 'full') {
    return client;
  }

  // Senior Technician - read-only contact information (no financial data)
  if (filter.fieldsRestriction === 'readonly') {
    return {
      id: client.id,
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      whatsappNumber: client.whatsappNumber,
      // Remove financial and sensitive data
      customerTier: undefined,
      paymentTerms: undefined,
      billingAddress: undefined,
      shippingAddress: undefined,
      gstin: undefined,
      accountManagerId: undefined,
      creditLimit: undefined,
      outstandingBalance: undefined,
    };
  }

  // AMC role - contact details only
  if (filter.fieldsRestriction === 'contact_only') {
    return {
      id: client.id,
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      whatsappNumber: client.whatsappNumber,
      // Remove everything else
      customerTier: undefined,
      paymentTerms: undefined,
      billingAddress: undefined,
      shippingAddress: undefined,
      gstin: undefined,
      accountManagerId: undefined,
    };
  }

  return client;
}

/**
 * Check if role should have access to client/customer data
 * Returns true if role can view customer/client information
 */
export function canAccessClientData(role: string): boolean {
  const normalizedRole = role.toLowerCase();

  // Admin has full access to all customer data
  if (normalizedRole === 'admin') {
    return true;
  }

  // Senior Technician has read-only contact access
  if (normalizedRole === 'senior_technician') {
    return true;
  }

  // AMC has limited contact-only access
  if (normalizedRole === 'amc') {
    return true;
  }

  // Technician and Client roles: NO customer data access
  return false;
}

/**
 * Check if a role has access to a specific page/feature
 * Based on the comprehensive role access specifications
 */
export function hasPageAccess(role: string, page: string): boolean {
  const normalizedRole = role.toLowerCase();
  const normalizedPage = page.toLowerCase();

  // 1. ADMIN - Complete system access (highest privilege)
  if (normalizedRole === 'admin') {
    return true; // Access to EVERYTHING including user management
  }

  // 2. SENIOR TECHNICIAN - Specialized technical operations
  if (normalizedRole === 'senior_technician') {
    const allowedPages = [
      'dashboard',
      'containers',        // Only refrigerated containers (all statuses, all IoT)
      'alerts',           // Related to their accessible containers
      'service-requests', // Related to their accessible containers
      'inventory',        // Parts access for service work
      'manuals',          // Technical documentation
      'rag-chat',         // AI diagnostic assistance
      'clients',          // Read-only contact information
      'my-profile',       // Personal profile updates
      'service-history'   // Service records
    ];
    return allowedPages.includes(normalizedPage);
  }

  // 3. TECHNICIAN - General field operations
  if (normalizedRole === 'technician') {
    const allowedPages = [
      'dashboard',        // Operational overview
      'containers',       // Only containers with allocated services
      'alerts',           // All alerts (for monitoring)
      'service-requests', // Only assigned service requests
      'inventory',        // Parts access for service work
      'whatsapp',         // Customer communication
      'manuals',          // Technical documentation
      'rag-chat',         // AI diagnostic assistance
      'service-history',  // Their completed service records
      'my-profile'        // Personal profile updates
    ];
    return allowedPages.includes(normalizedPage);
  }

  // 4. AMC (After Market Care) - Limited customer support
  if (normalizedRole === 'amc') {
    const allowedPages = [
      'containers',  // Only sold containers with contact info only
      'clients',     // Contact information only (no financial data)
      'my-profile'   // Personal profile updates
    ];
    return allowedPages.includes(normalizedPage);
  }

  // 5. CLIENT - Customer portal
  if (normalizedRole === 'client') {
    const allowedPages = [
      'client-dashboard',  // Personalized overview
      'containers',        // Only their assigned containers
      'alerts',           // Alerts from their containers only
      'service-requests', // Their service requests only
      'whatsapp',         // Direct communication with service team
      'my-profile'        // Personal profile updates
    ];
    return allowedPages.includes(normalizedPage);
  }

  return false;
}

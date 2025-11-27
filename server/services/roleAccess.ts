/**
 * Role-based Access Control Service
 *
 * This module handles access control logic for different user roles:
 * - senior_technician: Access to all reefer containers (type: refrigerated) with IoT enabled (deployed)
 * - amc: Access to only sold containers, limited to container details and client contact info
 */

import { Container } from "@shared/schema";

export interface RoleAccessFilter {
  role: string;
  allowedStatuses?: string[];
  allowedTypes?: string[];
  requiresIoT?: boolean;
  fieldsRestriction?: 'contact_only' | 'full';
}

/**
 * Get access filter configuration based on user role
 */
export function getRoleAccessFilter(role: string): RoleAccessFilter | null {
  const normalizedRole = role.toLowerCase();

  switch (normalizedRole) {
    case 'senior_technician':
      return {
        role: 'senior_technician',
        allowedTypes: ['refrigerated'], // All reefer containers
        requiresIoT: false, // Show all reefer containers regardless of IoT
        allowedStatuses: undefined, // Show all statuses
        fieldsRestriction: 'full'
      };

    case 'amc':
      return {
        role: 'amc',
        allowedStatuses: ['sold'], // Only sold containers
        fieldsRestriction: 'contact_only' // Limited to contact details
      };

    default:
      return null; // No special filtering for other roles
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
 * Get sanitized client/customer data for AMC role
 * Only contact information
 */
export function sanitizeClientForRole(client: any, role: string): any {
  const filter = getRoleAccessFilter(role);

  // No restrictions for most roles
  if (!filter || filter.fieldsRestriction !== 'contact_only') {
    return client;
  }

  // AMC role - only contact details
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
  };
}

/**
 * Check if a role has access to a specific page/feature
 */
export function hasPageAccess(role: string, page: string): boolean {
  const normalizedRole = role.toLowerCase();
  const normalizedPage = page.toLowerCase();

  // Admin and super_admin have access to everything
  if (['admin', 'super_admin'].includes(normalizedRole)) {
    return true;
  }

  // Senior Technician access
  if (normalizedRole === 'senior_technician') {
    const allowedPages = [
      'dashboard',
      'containers', // Only reefer, deployed containers
      'clients', // Read-only access to client data
      'alerts', // Related to their containers
      'service-requests', // Related to their containers
      'inventory',
      'manuals',
      'rag-chat',
      'my-profile'
    ];
    return allowedPages.includes(normalizedPage);
  }

  // AMC role access
  if (normalizedRole === 'amc') {
    const allowedPages = [
      'containers', // Only sold containers, limited fields
      'clients', // Only contact details
      'my-profile'
    ];
    return allowedPages.includes(normalizedPage);
  }

  // Client access
  if (normalizedRole === 'client') {
    const allowedPages = [
      'client-dashboard',
      'containers',
      'alerts',
      'service-requests',
      'whatsapp',
      'my-profile'
    ];
    return allowedPages.includes(normalizedPage);
  }

  // Technician access
  if (normalizedRole === 'technician') {
    const allowedPages = [
      'dashboard',
      'containers',
      'alerts',
      'service-requests',
      'inventory',
      'whatsapp',
      'manuals',
      'rag-chat',
      'my-profile',
      'service-history'
    ];
    return allowedPages.includes(normalizedPage);
  }

  // Coordinator access
  if (normalizedRole === 'coordinator') {
    const allowedPages = [
      'dashboard',
      'containers',
      'alerts',
      'service-requests',
      'technicians',
      'scheduling',
      'clients',
      'inventory',
      'whatsapp',
      'admin/whatsapp'
    ];
    return allowedPages.includes(normalizedPage);
  }

  return false;
}

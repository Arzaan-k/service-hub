/**
 * WhatsApp Technician Service Module - Core Functions
 * Handles technician-related WhatsApp flows
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate elapsed time from start time
 */
export function calculateElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / 60000);
  
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculate duration between two timestamps
 */
export function calculateDuration(startTime: Date | string, endTime: Date | string): string {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'Not scheduled';
  const d = new Date(date);
  // Check for invalid date (epoch time issue)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) {
    return 'Not scheduled';
  }
  return d.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}

/**
 * Format time for display
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return 'Not scheduled';
  const d = new Date(date);
  // Check for invalid date (epoch time issue - shows as 1970)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) {
    return 'Not scheduled';
  }
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format duration in minutes to readable string
 */
export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// ============================================================================
// MULTI-SERVICE TRACKING
// ============================================================================

/**
 * Add a service to active services list
 */
export async function addActiveService(session: any, serviceId: string, storage: any): Promise<void> {
  const activeServices = session.conversationState?.activeServices || [];
  
  // Check if already active
  if (activeServices.some((s: any) => s.serviceId === serviceId)) {
    return;
  }
  
  activeServices.push({
    serviceId,
    startTime: new Date().toISOString(),
    status: 'in_progress'
  });
  
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      activeServices
    }
  });
}

/**
 * Remove a service from active services list
 */
export async function removeActiveService(session: any, serviceId: string, storage: any): Promise<void> {
  const activeServices = session.conversationState?.activeServices || [];
  const updated = activeServices.filter((s: any) => s.serviceId !== serviceId);
  
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      activeServices: updated
    }
  });
}

/**
 * Get all active services for a technician
 */
export function getActiveServices(session: any): any[] {
  return session.conversationState?.activeServices || [];
}

/**
 * Get service ID by index (for "End Service 1, 2, 3" buttons)
 */
export function getServiceIdByIndex(session: any, index: number): string | null {
  const activeServices = getActiveServices(session);
  if (index >= 0 && index < activeServices.length) {
    return activeServices[index].serviceId;
  }
  return null;
}

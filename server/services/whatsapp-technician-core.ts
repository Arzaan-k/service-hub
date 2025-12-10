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
 * Get all active services for a technician (from session - may be stale)
 * Use getValidatedActiveServices for DB-validated list
 */
export function getActiveServices(session: any): any[] {
  return session.conversationState?.activeServices || [];
}

/**
 * Get validated active services - checks DB status and removes completed/cancelled ones
 * This syncs the session with actual database state
 */
export async function getValidatedActiveServices(session: any, storage: any): Promise<any[]> {
  const sessionActiveServices = session.conversationState?.activeServices || [];
  
  if (sessionActiveServices.length === 0) {
    return [];
  }
  
  // Validate each service against DB
  const validatedServices = [];
  const servicesToRemove = [];
  
  for (const activeService of sessionActiveServices) {
    try {
      const dbService = await storage.getServiceRequest(activeService.serviceId);
      
      // Only keep if service exists and is still in_progress
      if (dbService && dbService.status === 'in_progress') {
        validatedServices.push(activeService);
      } else {
        // Service is completed/cancelled in DB - mark for removal
        servicesToRemove.push(activeService.serviceId);
        console.log(`[WhatsApp] Removing stale active service: ${activeService.serviceId} (DB status: ${dbService?.status || 'not found'})`);
      }
    } catch (error) {
      console.error(`[WhatsApp] Error validating service ${activeService.serviceId}:`, error);
      // Keep it in case of error to avoid data loss
      validatedServices.push(activeService);
    }
  }
  
  // Update session if any services were removed
  if (servicesToRemove.length > 0) {
    try {
      await storage.updateWhatsappSession(session.id, {
        conversationState: {
          ...session.conversationState,
          activeServices: validatedServices
        }
      });
      console.log(`[WhatsApp] Synced session - removed ${servicesToRemove.length} stale services`);
    } catch (updateError) {
      console.error('[WhatsApp] Error updating session after validation:', updateError);
    }
  }
  
  return validatedServices;
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

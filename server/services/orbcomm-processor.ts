import { eq } from 'drizzle-orm';
import { containers } from '@shared/schema';
import { db } from '../db';
import { logger } from '../utils/logger';

// Types for Orbcomm message processing
export interface OrbcommMessage {
  lastAssetId?: string;
  deviceId?: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  temperature?: number;
  [key: string]: any; // Allow any additional metadata
}

export interface ContainerTelemetryUpdate {
  lastUpdateTimestamp: Date;
  locationLat?: number;
  locationLng?: number;
  lastTelemetry: any;
  lastSyncedAt: Date;
}

/**
 * Background task to process incoming Orbcomm messages and sync with database
 * This function handles the core logic for updating container telemetry
 */
export async function processOrbcommMessage(orbcommData: OrbcommMessage): Promise<void> {
  try {
    // Extract container identifier from Orbcomm data
    const containerId = orbcommData.lastAssetId || orbcommData.deviceId;
    
    if (!containerId) {
      logger.warn('Orbcomm message missing container identifier (lastAssetId/deviceId)', {
        message: orbcommData
      });
      return;
    }

    logger.info('Processing Orbcomm message', {
      containerId,
      timestamp: orbcommData.timestamp,
      hasLocation: !!(orbcommData.latitude && orbcommData.longitude)
    });

    // Database lookup: Find container by container_id (case-sensitive string comparison)
    const container = await db.query.containers.findFirst({
      where: eq(containers.containerCode, containerId)
    });

    if (!container) {
      logger.warn(`No container match found for lastAssetId ${containerId}`, {
        containerId,
        message: orbcommData
      });
      return;
    }

    // Prepare telemetry update data
    const telemetryUpdate: Partial<ContainerTelemetryUpdate> = {
      lastUpdateTimestamp: new Date(orbcommData.timestamp),
      lastTelemetry: orbcommData, // Store full raw JSON from Orbcomm as-is
      lastSyncedAt: new Date()
    };

    // Add location data if available
    if (orbcommData.latitude !== undefined && orbcommData.longitude !== undefined) {
      telemetryUpdate.locationLat = orbcommData.latitude;
      telemetryUpdate.locationLng = orbcommData.longitude;
    }

    // Update container record in database
    await db.update(containers)
      .set({
        lastUpdateTimestamp: telemetryUpdate.lastUpdateTimestamp,
        locationLat: telemetryUpdate.locationLat,
        locationLng: telemetryUpdate.locationLng,
        lastTelemetry: telemetryUpdate.lastTelemetry,
        lastSyncedAt: telemetryUpdate.lastSyncedAt,
        updatedAt: new Date()
      })
      .where(eq(containers.id, container.id));

    logger.info('Container telemetry updated successfully', {
      containerId,
      containerDbId: container.id,
      timestamp: orbcommData.timestamp,
      location: orbcommData.latitude && orbcommData.longitude ? 
        `${orbcommData.latitude}, ${orbcommData.longitude}` : 'N/A'
    });

    // Emit real-time update for frontend
    await emitContainerUpdate(container.id, {
      containerId,
      timestamp: orbcommData.timestamp,
      location: orbcommData.latitude && orbcommData.longitude ? {
        lat: orbcommData.latitude,
        lng: orbcommData.longitude
      } : null,
      telemetry: orbcommData
    });

  } catch (error) {
    logger.error('Error processing Orbcomm message', {
      error: error.message,
      stack: error.stack,
      message: orbcommData
    });
    throw error;
  }
}

/**
 * Emit real-time container update to connected WebSocket clients
 */
async function emitContainerUpdate(containerDbId: string, updateData: any): Promise<void> {
  try {
    // Use your existing WebSocket broadcast mechanism
    if (typeof (global as any).broadcast === 'function') {
      (global as any).broadcast({
        type: 'container_telemetry_update',
        data: {
          containerId: containerDbId,
          ...updateData,
          timestamp: Date.now()
        }
      });
    }
  } catch (error) {
    logger.error('Error emitting container update', {
      error: error.message,
      containerDbId,
      updateData
    });
  }
}

/**
 * Batch process multiple Orbcomm messages for efficiency
 */
export async function processOrbcommMessagesBatch(messages: OrbcommMessage[]): Promise<void> {
  logger.info(`Processing batch of ${messages.length} Orbcomm messages`);
  
  const results = await Promise.allSettled(
    messages.map(message => processOrbcommMessage(message))
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  logger.info('Batch processing completed', {
    total: messages.length,
    successful,
    failed
  });

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error('Failed to process message in batch', {
        index,
        error: result.reason.message,
        message: messages[index]
      });
    }
  });
}

/**
 * Validate Orbcomm message format before processing
 */
export function validateOrbcommMessage(data: any): data is OrbcommMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Must have either lastAssetId or deviceId
  if (!data.lastAssetId && !data.deviceId) {
    return false;
  }

  // Must have timestamp
  if (!data.timestamp) {
    return false;
  }

  return true;
}

/**
 * Get container telemetry history for a specific container
 */
export async function getContainerTelemetryHistory(
  containerId: string, 
  limit: number = 100
): Promise<any[]> {
  try {
    const container = await db.query.containers.findFirst({
      where: eq(containers.containerCode, containerId)
    });

    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Return recent telemetry data
    return [{
      containerId: container.containerCode,
      lastUpdateTimestamp: container.lastUpdateTimestamp,
      locationLat: container.locationLat,
      locationLng: container.locationLng,
      lastTelemetry: container.lastTelemetry,
      lastSyncedAt: container.lastSyncedAt
    }];
  } catch (error) {
    logger.error('Error fetching container telemetry history', {
      error: error.message,
      containerId
    });
    throw error;
  }
}

/**
 * Health check for Orbcomm message processing
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastProcessedAt?: Date;
  totalProcessed: number;
  errors: number;
}> {
  try {
    // This would typically check a metrics table or cache
    // For now, return basic health status
    return {
      status: 'healthy',
      totalProcessed: 0,
      errors: 0
    };
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      totalProcessed: 0,
      errors: 1
    };
  }
}

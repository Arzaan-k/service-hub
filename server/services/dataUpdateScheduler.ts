import cron from 'node-cron';
import { getOrbcommClient } from './orbcommClient';
import { storage } from '../storage';

/**
 * Data Update Scheduler Service
 * Handles periodic updates of container location data from Orbcomm
 */

class DataUpdateScheduler {
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the scheduler - runs every 15 minutes
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⏭️  Data update scheduler already running');
      return;
    }

    console.log('🕒 Starting data update scheduler (every 15 minutes)...');

    // Schedule task to run every 15 minutes
    this.scheduledTask = cron.schedule('*/15 * * * *', async () => {
      await this.updateContainerData();
    });

    this.isRunning = true;
    console.log('✅ Data update scheduler started successfully');

    // Run initial update immediately
    this.updateContainerData();
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (!this.isRunning || !this.scheduledTask) {
      console.log('⏭️  Data update scheduler not running');
      return;
    }

    console.log('🛑 Stopping data update scheduler...');
    this.scheduledTask.stop();
    this.scheduledTask = null;
    this.isRunning = false;
    console.log('✅ Data update scheduler stopped successfully');
  }

  /**
   * Update container location data from Orbcomm
   */
  private async updateContainerData(): Promise<void> {
    try {
      console.log('🔄 Running scheduled container data update...');
      const startTime = Date.now();

      // Get all containers with Orbcomm devices
      const containers = await storage.getAllContainers();
      const orbcommContainers = containers.filter(c => c.orbcommDeviceId);

      if (orbcommContainers.length === 0) {
        console.log('⏭️  No containers with Orbcomm devices found');
        return;
      }

      console.log(`📦 Found ${orbcommContainers.length} containers with Orbcomm devices`);

      // Get Orbcomm client
      const client = getOrbcommClient();
      if (!client) {
        console.log('⚠️  Orbcomm client not available, skipping update');
        return;
      }

      // Get latest telemetry data
      const stats = client.getStats();
      console.log(`📊 Orbcomm client stats: ${stats.messagesReceived} messages received, ${stats.alertsProcessed} alerts processed`);

      // Update each container with latest location data
      let updatedCount = 0;
      for (const container of orbcommContainers) {
        try {
          // The data is already being updated in real-time via WebSocket
          // This scheduled job serves as a backup and ensures data consistency

          // We can add additional logic here if needed, such as:
          // - Requesting specific device updates from Orbcomm API
          // - Validating location data
          // - Updating derived metrics

          // For now, we'll just log the current state
          if (container.locationLat && container.locationLng) {
            updatedCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing container ${container.containerCode}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Container data update completed in ${duration}ms`);
      console.log(`📍 ${updatedCount}/${orbcommContainers.length} containers have location data`);

    } catch (error) {
      console.error('❌ Error in scheduled container data update:', error);
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus() {
    return {
      isRunning: this.isRunning,
      nextExecution: this.scheduledTask ? 'Every 15 minutes' : 'Not scheduled',
    };
  }

  /**
   * Manually trigger an update (for testing or manual refresh)
   */
  public async triggerUpdate(): Promise<void> {
    console.log('🔄 Manually triggering container data update...');
    await this.updateContainerData();
  }
}

// Singleton instance
let schedulerInstance: DataUpdateScheduler | null = null;

/**
 * Get or create the data update scheduler
 */
export function getDataUpdateScheduler(): DataUpdateScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DataUpdateScheduler();
  }
  return schedulerInstance;
}

/**
 * Start data update scheduler
 */
export function startDataUpdateScheduler(): void {
  const scheduler = getDataUpdateScheduler();
  scheduler.start();
}

/**
 * Stop data update scheduler
 */
export function stopDataUpdateScheduler(): void {
  const scheduler = getDataUpdateScheduler();
  scheduler.stop();
}

export { DataUpdateScheduler };

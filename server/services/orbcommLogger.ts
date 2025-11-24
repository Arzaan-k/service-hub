import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

/**
 * Orbcomm Alert Logger
 * Logs all Orbcomm CDH alerts to an Excel file for record keeping
 */

interface OrbcommAlert {
  timestamp: Date;
  alertId?: string;
  deviceId?: string;
  messageType?: string;
  latitude?: number;
  longitude?: number;
  alertType?: string;
  severity?: string;
  description?: string;
  rawData: any;
}

class OrbcommLogger {
  private workbook: ExcelJS.Workbook;
  private worksheet: ExcelJS.Worksheet;
  private filePath: string;
  private logsDir: string;
  private writeQueue: OrbcommAlert[] = [];
  private isWriting = false;

  constructor() {
    // Create logs directory if it doesn't exist
    this.logsDir = path.join(process.cwd(), 'logs', 'orbcomm');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.filePath = path.join(this.logsDir, `orbcomm_alerts_${dateStr}.xlsx`);

    this.workbook = new ExcelJS.Workbook();

    // Initialize synchronously - create new worksheet immediately
    this.worksheet = this.workbook.addWorksheet('Alerts');
    this.setupWorksheetHeaders();

    // Load existing file asynchronously in the background
    this.loadExistingFile();

    console.log(`📊 Orbcomm logger initialized. Logs will be saved to: ${this.filePath}`);
  }

  /**
   * Load existing file asynchronously
   */
  private async loadExistingFile(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        await this.workbook.xlsx.readFile(this.filePath);
        this.worksheet = this.workbook.getWorksheet('Alerts') || this.workbook.addWorksheet('Alerts');
        console.log(`📂 Loaded existing Orbcomm log file: ${this.filePath}`);
      }
    } catch (error) {
      console.error('❌ Failed to load existing file:', error);
      // Keep using the newly created worksheet
    }
  }

  /**
   * Setup worksheet headers with formatting
   */
  private setupWorksheetHeaders(): void {
    // Define columns
    this.worksheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Alert ID', key: 'alertId', width: 25 },
      { header: 'Device ID', key: 'deviceId', width: 25 },
      { header: 'Message Type', key: 'messageType', width: 20 },
      { header: 'Latitude', key: 'latitude', width: 15 },
      { header: 'Longitude', key: 'longitude', width: 15 },
      { header: 'Alert Type', key: 'alertType', width: 20 },
      { header: 'Severity', key: 'severity', width: 15 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Raw JSON', key: 'rawData', width: 100 },
    ];

    // Style header row
    const headerRow = this.worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Freeze header row
    this.worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
  }

  /**
   * Log an alert to Excel
   */
  public async logAlert(alert: any): Promise<void> {
    const parsedAlert: OrbcommAlert = this.parseAlert(alert);
    this.writeQueue.push(parsedAlert);

    // Process queue
    await this.processWriteQueue();
  }

  /**
   * Parse alert data into structured format
   */
  private parseAlert(alert: any): OrbcommAlert {
    const parsed: OrbcommAlert = {
      timestamp: new Date(),
      rawData: alert,
    };

    try {
      // Extract common fields (adjust based on actual Orbcomm alert structure)
      if (alert.data) {
        parsed.alertId = alert.data.alertId || alert.data.id || alert.data.messageId;
        parsed.deviceId = alert.data.deviceId || alert.data.mobileId || alert.data.imei;
        parsed.messageType = alert.data.messageType || alert.type;
        parsed.alertType = alert.data.alertType || alert.data.type;
        parsed.severity = alert.data.severity || alert.data.priority;
        parsed.description = alert.data.description || alert.data.message;

        // Location data
        if (alert.data.location || alert.data.position) {
          const loc = alert.data.location || alert.data.position;
          parsed.latitude = loc.latitude || loc.lat;
          parsed.longitude = loc.longitude || loc.lng || loc.lon;
        }

        if (alert.data.latitude !== undefined) {
          parsed.latitude = alert.data.latitude;
        }
        if (alert.data.longitude !== undefined) {
          parsed.longitude = alert.data.longitude;
        }
      }

      // Handle different alert structures
      if (alert.alertId) parsed.alertId = alert.alertId;
      if (alert.deviceId) parsed.deviceId = alert.deviceId;
      if (alert.messageType) parsed.messageType = alert.messageType;
      if (alert.alertType) parsed.alertType = alert.alertType;
      if (alert.severity) parsed.severity = alert.severity;

    } catch (error) {
      console.error('❌ Error parsing alert:', error);
    }

    return parsed;
  }

  /**
   * Process write queue (batched writes to avoid file conflicts)
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      // Process all queued alerts
      while (this.writeQueue.length > 0) {
        const alert = this.writeQueue.shift();
        if (!alert) continue;

        // Add row to worksheet
        this.worksheet.addRow({
          timestamp: alert.timestamp.toISOString(),
          alertId: alert.alertId || 'N/A',
          deviceId: alert.deviceId || 'N/A',
          messageType: alert.messageType || 'N/A',
          latitude: alert.latitude || 'N/A',
          longitude: alert.longitude || 'N/A',
          alertType: alert.alertType || 'N/A',
          severity: alert.severity || 'N/A',
          description: alert.description || 'N/A',
          rawData: JSON.stringify(alert.rawData),
        });

        console.log(`✅ Logged alert to Excel: ${alert.alertId || 'Unknown'}`);
      }

      // Save workbook
      await this.saveWorkbook();

    } catch (error) {
      console.error('❌ Error processing write queue:', error);
    } finally {
      this.isWriting = false;

      // Check if more items were added while writing
      if (this.writeQueue.length > 0) {
        setTimeout(() => this.processWriteQueue(), 1000);
      }
    }
  }

  /**
   * Save workbook to file
   */
  private async saveWorkbook(): Promise<void> {
    try {
      await this.workbook.xlsx.writeFile(this.filePath);
      console.log(`💾 Saved Orbcomm log file: ${this.filePath}`);
    } catch (error) {
      console.error('❌ Failed to save workbook:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  public getStats() {
    return {
      filePath: this.filePath,
      totalRows: this.worksheet.rowCount - 1, // Exclude header
      queueLength: this.writeQueue.length,
      isWriting: this.isWriting,
    };
  }

  /**
   * Close logger and save final state
   */
  public async close(): Promise<void> {
    console.log('🔒 Closing Orbcomm logger...');

    // Process remaining queue items
    while (this.writeQueue.length > 0) {
      await this.processWriteQueue();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await this.saveWorkbook();
    console.log('✅ Orbcomm logger closed');
  }
}

// Singleton instance
let orbcommLogger: OrbcommLogger | null = null;

/**
 * Get or create the Orbcomm logger instance
 */
export function getOrbcommLogger(): OrbcommLogger {
  if (!orbcommLogger) {
    orbcommLogger = new OrbcommLogger();
  }
  return orbcommLogger;
}

/**
 * Log an alert to Excel
 */
export async function logOrbcommAlert(alert: any): Promise<void> {
  const logger = getOrbcommLogger();
  await logger.logAlert(alert);
}

/**
 * Close the logger
 */
export async function closeOrbcommLogger(): Promise<void> {
  if (orbcommLogger) {
    await orbcommLogger.close();
    orbcommLogger = null;
  }
}

export { OrbcommLogger };

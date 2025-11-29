/**
 * Excel Import Service for Service History
 * 
 * Imports service history data from Excel files and creates/updates service requests
 * with proper job order numbering (MMMXXX format)
 */

import * as XLSX from 'xlsx';
import { db } from '../db';
import { serviceRequests, containers } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { generateJobOrderNumber } from '../utils/jobOrderGenerator';

interface ServiceHistoryRow {
  containerCode?: string;
  unitNumber?: string;
  serviceDate?: Date | string;
  serviceType?: string;
  workType?: string;
  issueDescription?: string;
  resolutionNotes?: string;
  technicianName?: string;
  partsUsed?: string;
  status?: string;
  priority?: string;
  // Additional fields from Excel
  [key: string]: any;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
  containersCreated: number;
}

/**
 * Parse Excel file and extract service history data
 */
export function parseExcelFile(buffer: Buffer): ServiceHistoryRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const rawData = XLSX.utils.sheet_to_json(worksheet, { 
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  // Normalize column names
  return rawData.map((row: any) => {
    const normalized: ServiceHistoryRow = {};
    
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeColumnName(key);
      normalized[normalizedKey] = value;
    }
    
    return normalized;
  });
}

/**
 * Normalize column names to match expected fields
 */
function normalizeColumnName(name: string): string {
  const lowered = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  const mappings: Record<string, string> = {
    'containercode': 'containerCode',
    'unitnumber': 'containerCode',
    'unitno': 'containerCode',
    'container': 'containerCode',
    'servicedate': 'serviceDate',
    'date': 'serviceDate',
    'servicetype': 'serviceType',
    'type': 'serviceType',
    'worktype': 'workType',
    'work': 'workType',
    'issue': 'issueDescription',
    'issuedescription': 'issueDescription',
    'description': 'issueDescription',
    'problem': 'issueDescription',
    'resolution': 'resolutionNotes',
    'resolutionnotes': 'resolutionNotes',
    'notes': 'resolutionNotes',
    'technician': 'technicianName',
    'technicianname': 'technicianName',
    'tech': 'technicianName',
    'parts': 'partsUsed',
    'partsused': 'partsUsed',
    'status': 'status',
    'priority': 'priority',
    'joborder': 'jobOrder',
    'jobnumber': 'jobOrder',
    'requestnumber': 'requestNumber',
  };
  
  return mappings[lowered] || name;
}

/**
 * Import service history from parsed Excel data
 */
export async function importServiceHistory(
  data: ServiceHistoryRow[],
  options: {
    createMissingContainers?: boolean;
    updateExisting?: boolean;
    defaultPriority?: string;
    defaultStatus?: string;
  } = {}
): Promise<ImportResult> {
  const {
    createMissingContainers = true,
    updateExisting = true,
    defaultPriority = 'normal',
    defaultStatus = 'completed',
  } = options;

  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    containersCreated: 0,
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // Excel row number (1-indexed + header)

    try {
      // Validate required fields
      if (!row.containerCode) {
        result.errors.push({ row: rowNum, error: 'Missing container code' });
        result.skipped++;
        continue;
      }

      // Find or create container
      let container = await db.query.containers.findFirst({
        where: eq(containers.containerCode, row.containerCode),
      });

      if (!container) {
        if (createMissingContainers) {
          // Create container with minimal info
          const [newContainer] = await db.insert(containers).values({
            containerCode: row.containerCode,
            type: 'unknown',
            capacity: 'unknown',
            status: 'active',
            hasIot: false,
          }).returning();
          container = newContainer;
          result.containersCreated++;
          console.log(`📦 Created container: ${row.containerCode}`);
        } else {
          result.errors.push({ row: rowNum, error: `Container not found: ${row.containerCode}` });
          result.skipped++;
          continue;
        }
      }

      // Parse service date
      let serviceDate: Date;
      if (row.serviceDate) {
        if (row.serviceDate instanceof Date) {
          serviceDate = row.serviceDate;
        } else {
          serviceDate = new Date(row.serviceDate);
        }
        if (isNaN(serviceDate.getTime())) {
          serviceDate = new Date();
        }
      } else {
        serviceDate = new Date();
      }

      // Check for existing service request with same container and date
      const existingRequest = await db.query.serviceRequests.findFirst({
        where: sql`container_id = ${container.id} AND DATE(created_at) = DATE(${serviceDate.toISOString()})`,
      });

      if (existingRequest) {
        if (updateExisting) {
          // Update existing request
          await db.update(serviceRequests)
            .set({
              issueDescription: row.issueDescription || existingRequest.issueDescription,
              resolutionSummary: row.resolutionNotes || existingRequest.resolutionSummary,
              serviceType: row.serviceType || existingRequest.serviceType,
              workType: row.workType || existingRequest.workType,
              excelData: row,
              updatedAt: new Date(),
            })
            .where(eq(serviceRequests.id, existingRequest.id));
          
          result.updated++;
          console.log(`📝 Updated service request: ${existingRequest.requestNumber}`);
        } else {
          result.skipped++;
        }
        continue;
      }

      // Generate job order number based on service date
      const jobOrderNumber = await generateJobOrderNumber(serviceDate);

      // Create new service request
      await db.insert(serviceRequests).values({
        requestNumber: jobOrderNumber,
        jobOrder: jobOrderNumber,
        containerId: container.id,
        issueDescription: row.issueDescription || `Service from Excel import - ${row.serviceType || 'General'}`,
        priority: (row.priority as any) || defaultPriority,
        status: (row.status as any) || defaultStatus,
        serviceType: row.serviceType,
        workType: row.workType,
        resolutionSummary: row.resolutionNotes,
        excelData: row,
        createdAt: serviceDate,
        updatedAt: new Date(),
        requestedAt: serviceDate,
        actualStartTime: serviceDate,
        actualEndTime: serviceDate,
      });

      result.imported++;
      console.log(`✅ Imported service request: ${jobOrderNumber} for ${row.containerCode}`);

    } catch (error: any) {
      result.errors.push({ row: rowNum, error: error.message });
      console.error(`❌ Error importing row ${rowNum}:`, error.message);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Get import preview without actually importing
 */
export function getImportPreview(data: ServiceHistoryRow[], limit = 10): {
  columns: string[];
  preview: ServiceHistoryRow[];
  totalRows: number;
} {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  return {
    columns,
    preview: data.slice(0, limit),
    totalRows: data.length,
  };
}

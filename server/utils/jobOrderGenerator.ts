import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Generate a job order number in the format MMMXXX (e.g., JAN001, FEB045, DEC999)
 * - MMM: 3-letter month abbreviation (JAN, FEB, MAR, etc.)
 * - XXX: 3-digit sequential number starting from 001
 *
 * @param customDate Optional date to use for month. If not provided, uses current month.
 * @returns Job order number string (e.g., "JAN001")
 */
export async function generateJobOrderNumber(customDate?: Date): Promise<string> {
  const date = customDate || new Date();

  // Get 3-letter month abbreviation in uppercase
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthPrefix = monthNames[date.getMonth()];
  const year = date.getFullYear();

  // Find the highest job order number for this month and year
  const result = await db.execute(sql`
    SELECT job_order
    FROM service_requests
    WHERE job_order LIKE ${monthPrefix + '%'}
      AND EXTRACT(YEAR FROM created_at) = ${year}
      AND job_order IS NOT NULL
    ORDER BY job_order DESC
    LIMIT 1
  `);

  let nextNumber = 1;

  if (result.rows.length > 0) {
    const lastJobOrder = result.rows[0].job_order as string;
    // Extract the numeric part (last 3 digits)
    const lastNumber = parseInt(lastJobOrder.substring(3));
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Format with leading zeros (3 digits)
  const paddedNumber = nextNumber.toString().padStart(3, '0');

  return `${monthPrefix}${paddedNumber}`;
}

/**
 * Parse a job order number to extract month and sequence number
 * @param jobOrder Job order string (e.g., "JAN001")
 * @returns Object with month and number, or null if invalid format
 */
export function parseJobOrderNumber(jobOrder: string): { month: string; number: number } | null {
  if (!jobOrder || jobOrder.length !== 6) {
    return null;
  }

  const month = jobOrder.substring(0, 3);
  const numberStr = jobOrder.substring(3);
  const number = parseInt(numberStr);

  if (isNaN(number)) {
    return null;
  }

  return { month, number };
}

/**
 * Validate a job order number format
 * @param jobOrder Job order string to validate
 * @returns true if valid format, false otherwise
 */
export function isValidJobOrderFormat(jobOrder: string): boolean {
  if (!jobOrder || jobOrder.length !== 6) {
    return false;
  }

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = jobOrder.substring(0, 3).toUpperCase();
  const numberStr = jobOrder.substring(3);

  return monthNames.includes(month) && /^\d{3}$/.test(numberStr);
}

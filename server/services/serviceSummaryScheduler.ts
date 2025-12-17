import cron from 'node-cron';
import { db } from '../db';
import { serviceRequests, dailySummaryAcknowledgment, technicians, customers, containers } from '@shared/schema';
import { sendEmail } from './emailService';
import { eq, and, gte, lte, desc, isNotNull, sql } from 'drizzle-orm';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

/**
 * Service Summary Scheduler
 * 
 * Handles the scheduled email workflow for daily service summaries:
 * 1. Pre-fetch service history at configured time (default 5:55 AM)
 * 2. Send service summary email to expert technician at configured time (default 6:00 AM)
 * 3. Check for acknowledgment and escalate to CEO if needed at configured time (default 12:00 PM)
 * 
 * Environment Variables:
 * - SERVICE_HISTORY_FETCH_TIME: Time to pre-fetch data (HH:MM format, default "05:55")
 * - SERVICE_SUMMARY_EMAIL_TIME: Time to send email to expert (HH:MM format, default "06:00")
 * - CEO_ESCALATION_TIME: Time to escalate to CEO if no ack (HH:MM format, default "12:00")
 * - EXPERT_TECHNICIAN_EMAIL: Email of expert technician (required)
 * - CEO_EMAIL: Email of CEO for escalation (required)
 */

// Cache for pre-fetched service history
interface CachedServiceHistory {
  date: string;
  fetchedAt: Date;
  data: ServiceSummaryData | null;
}

interface ServiceSummaryData {
  summary: DailySummary;
  serviceRequests: any[];
  technicianDetails: any[];
  date: string;
}

interface DailySummary {
  totalRequests: number;
  assigned: number;
  technicianAssigned: number;
  inProgress: number;
  technicianStarted: number;
  completed: number;
  delayed: number;
  pending: number;
  date: string;
}

// In-memory cache for service history
let cachedServiceHistory: CachedServiceHistory | null = null;

// Get environment variables with defaults
function getEnvConfig() {
  const config = {
    fetchTime: process.env.SERVICE_HISTORY_FETCH_TIME || '05:55',
    emailTime: process.env.SERVICE_SUMMARY_EMAIL_TIME || '06:00',
    escalationTime: process.env.CEO_ESCALATION_TIME || '12:00',
    // Minutes before escalation to send reminder to expert tech
    reminderMinutesBeforeEscalation: Number(process.env.SUMMARY_REMINDER_MINUTES_BEFORE_ESCALATION || 60),
    expertTechnicianEmail: process.env.EXPERT_TECHNICIAN_EMAIL || 'chavandhiksha212@gmail.com',
    ceoEmail: process.env.CEO_EMAIL || 'chavandhiksha2003@gmail.com',
    appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000',
  };
  
  // Debug: Log raw env values on first call
  if (!envConfigLogged) {
    console.log('[ServiceSummaryScheduler] Raw ENV values:');
    console.log(`  - SERVICE_HISTORY_FETCH_TIME: "${process.env.SERVICE_HISTORY_FETCH_TIME}" → using: "${config.fetchTime}"`);
    console.log(`  - SERVICE_SUMMARY_EMAIL_TIME: "${process.env.SERVICE_SUMMARY_EMAIL_TIME}" → using: "${config.emailTime}"`);
    console.log(`  - CEO_ESCALATION_TIME: "${process.env.CEO_ESCALATION_TIME}" → using: "${config.escalationTime}"`);
    console.log(`  - SUMMARY_REMINDER_MINUTES_BEFORE_ESCALATION: "${process.env.SUMMARY_REMINDER_MINUTES_BEFORE_ESCALATION}" → using: "${config.reminderMinutesBeforeEscalation}"`);
    console.log(`  - EXPERT_TECHNICIAN_EMAIL: "${process.env.EXPERT_TECHNICIAN_EMAIL}" → using: "${config.expertTechnicianEmail}"`);
    console.log(`  - CEO_EMAIL: "${process.env.CEO_EMAIL}" → using: "${config.ceoEmail}"`);
    envConfigLogged = true;
  }
  
  return config;
}

// Flag to only log env config once
let envConfigLogged = false;

// Validate time format (HH:MM)
function validateTimeFormat(time: string, varName: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(time)) {
    console.error(`[ServiceSummaryScheduler] ❌ Invalid time format for ${varName}: "${time}". Expected HH:MM (24-hour format)`);
    return false;
  }
  return true;
}

// Convert HH:MM to cron expression
function timeToCron(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const cronExpr = `${minute} ${hour} * * *`; // minute hour * * * (every day)
  console.log(`[ServiceSummaryScheduler] Time "${time}" → Cron: "${cronExpr}"`);
  return cronExpr;
}

// Subtract minutes from HH:MM; returns HH:MM or null if it would roll to previous day
function subtractMinutesFromTime(time: string, minutesToSubtract: number): string | null {
  const [hourStr, minStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minStr);
  const totalMinutes = hour * 60 + minute - minutesToSubtract;
  if (totalMinutes < 0) {
    return null; // would go to previous day; skip in this simple scheduler
  }
  const newHour = Math.floor(totalMinutes / 60);
  const newMin = totalMinutes % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(newHour)}:${pad(newMin)}`;
}

/**
 * Pre-fetch and cache service history for the previous day
 * This runs before the email send time to ensure data is ready
 */
async function prefetchServiceHistory(): Promise<void> {
  const config = getEnvConfig();
  console.log(`[ServiceSummaryScheduler] Pre-fetching service history at ${new Date().toLocaleString()}`);
  
  try {
    const yesterday = subDays(new Date(), 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    const dateStr = format(yesterday, 'yyyy-MM-dd');
    
    // Fetch all service requests from the previous day
    const requests = await db.query.serviceRequests.findMany({
      where: and(
        gte(serviceRequests.createdAt, start),
        lte(serviceRequests.createdAt, end)
      ),
    });
    
    // Calculate summary statistics
    const summary: DailySummary = {
      totalRequests: requests.length,
      assigned: 0,
      technicianAssigned: 0,
      inProgress: 0,
      technicianStarted: 0,
      completed: 0,
      delayed: 0,
      pending: 0,
      date: dateStr,
    };
    
    for (const req of requests) {
      if (req.status === 'pending') summary.pending++;
      if (['approved', 'scheduled', 'in_progress', 'completed'].includes(req.status || '')) {
        summary.assigned++;
      }
      if (req.assignedTechnicianId) summary.technicianAssigned++;
      if (req.status === 'in_progress') summary.inProgress++;
      if (req.actualStartTime) summary.technicianStarted++;
      if (req.status === 'completed') summary.completed++;
      
      // Check if delayed
      if (req.scheduledDate && new Date(req.scheduledDate) < new Date() && req.status !== 'completed') {
        summary.delayed++;
      }
    }
    
    // Fetch technician details for assigned requests
    const assignedTechIds = [...new Set(requests
      .filter(r => r.assignedTechnicianId)
      .map(r => r.assignedTechnicianId))];
    
    const technicianDetails = await Promise.all(
      assignedTechIds.map(async (techId) => {
        if (!techId) return null;
        const tech = await db.query.technicians.findFirst({
          where: eq(technicians.id, techId),
        });
        if (!tech) return null;
        
        const techRequests = requests.filter(r => r.assignedTechnicianId === techId);
        return {
          technician: tech,
          requestCount: techRequests.length,
          completed: techRequests.filter(r => r.status === 'completed').length,
          inProgress: techRequests.filter(r => r.status === 'in_progress').length,
        };
      })
    );
    
    // Enrich service requests with customer and container info
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        let customer = null;
        let container = null;
        
        if (req.customerId) {
          customer = await db.query.customers.findFirst({
            where: eq(customers.id, req.customerId),
          });
        }
        
        if (req.containerId) {
          container = await db.query.containers.findFirst({
            where: eq(containers.id, req.containerId),
          });
        }
        
        return {
          ...req,
          customerName: customer?.companyName || 'Unknown',
          containerCode: container?.containerCode || 'N/A',
        };
      })
    );
    
    // Store in cache
    cachedServiceHistory = {
      date: dateStr,
      fetchedAt: new Date(),
      data: {
        summary,
        serviceRequests: enrichedRequests,
        technicianDetails: technicianDetails.filter(Boolean),
        date: dateStr,
      },
    };
    
    console.log(`[ServiceSummaryScheduler] ✅ Service history cached for ${dateStr}:`);
    console.log(`  - Total Requests: ${summary.totalRequests}`);
    console.log(`  - Completed: ${summary.completed}`);
    console.log(`  - Pending: ${summary.pending}`);
    console.log(`  - Delayed: ${summary.delayed}`);
    console.log(`  - Technicians: ${technicianDetails.filter(Boolean).length}`);
    
  } catch (error) {
    console.error('[ServiceSummaryScheduler] ❌ Error pre-fetching service history:', error);
  }
}

/**
 * Get cached service history or fetch if not available
 */
function getCachedServiceHistory(): ServiceSummaryData | null {
  const today = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  if (cachedServiceHistory && cachedServiceHistory.date === today) {
    console.log(`[ServiceSummaryScheduler] Using cached data from ${cachedServiceHistory.fetchedAt.toLocaleString()}`);
    return cachedServiceHistory.data;
  }
  
  console.log('[ServiceSummaryScheduler] No valid cached data available');
  return null;
}

/**
 * Generate email HTML for service summary
 */
function generateEmailHtml(data: ServiceSummaryData, acknowledgmentLink: string, isEscalation: boolean = false): string {
  const { summary, serviceRequests: requests, technicianDetails } = data;
  const title = isEscalation
    ? `ESCALATION: Daily Service Summary Not Acknowledged – ${summary.date}`
    : `Daily Service Request Summary – ${summary.date}`;
  
  const color = isEscalation ? '#d32f2f' : '#1976d2';
  
  // Build technician performance table
  let technicianTable = '';
  if (technicianDetails.length > 0) {
    technicianTable = `
      <h3 style="color: #333; margin-top: 20px;">Technician Performance</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Technician</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Assigned</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Completed</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">In Progress</th>
        </tr>
        ${technicianDetails.map((t: any) => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${t.technician.name || t.technician.employeeCode || 'Unknown'}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${t.requestCount}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: green;">${t.completed}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: orange;">${t.inProgress}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  // Build service requests table (last 10)
  let requestsTable = '';
  if (requests.length > 0) {
    const recentRequests = requests.slice(0, 10);
    requestsTable = `
      <h3 style="color: #333; margin-top: 20px;">Recent Service Requests</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Request #</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Customer</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Container</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Status</th>
        </tr>
        ${recentRequests.map((r: any) => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${r.requestNumber || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${r.customerName}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${r.containerCode}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
              <span style="padding: 3px 8px; border-radius: 12px; background-color: ${getStatusColor(r.status)}; color: white; font-size: 12px;">
                ${(r.status || 'pending').toUpperCase()}
              </span>
            </td>
          </tr>
        `).join('')}
      </table>
      ${requests.length > 10 ? `<p style="color: #666; font-size: 12px;">... and ${requests.length - 10} more requests</p>` : ''}
    `;
  }
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: ${color};">${title}</h2>
      <p>Here is the service summary for ${summary.date}:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Metric</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Count</th>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Total Requests</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${summary.totalRequests}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Assigned</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.assigned}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Technician Assigned</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.technicianAssigned}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">In Progress</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: orange;">${summary.inProgress}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Technician Started</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.technicianStarted}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Completed</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: green;">${summary.completed}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Delayed</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${summary.delayed > 0 ? 'red' : 'inherit'}; font-weight: ${summary.delayed > 0 ? 'bold' : 'normal'};">${summary.delayed}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Pending</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.pending}</td>
        </tr>
      </table>

      ${technicianTable}
      ${requestsTable}

      ${!isEscalation ? `
        <div style="text-align: center; margin-top: 30px;">
          <a href="${acknowledgmentLink}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Acknowledge Summary</a>
          <p style="margin-top: 15px; font-size: 12px; color: #666;">
            ⚠️ Warning: If acknowledgment is not done by noon, CEO will be notified.
          </p>
        </div>
      ` : `
        <div style="margin-top: 20px; padding: 15px; background-color: #ffebee; border-left: 4px solid #d32f2f;">
          <p style="margin: 0; color: #d32f2f; font-weight: bold;">
            ⚠️ Acknowledgment from Expert Technician was not received by the deadline.
          </p>
        </div>
      `}
      
      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
        <p>This is an automated email from Service Hub.</p>
        <p>Generated at: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'completed': '#4caf50',
    'in_progress': '#ff9800',
    'scheduled': '#2196f3',
    'pending': '#9e9e9e',
    'cancelled': '#f44336',
    'approved': '#00bcd4',
  };
  return colors[status?.toLowerCase()] || '#9e9e9e';
}

/**
 * Send daily service summary email to expert technician
 */
async function sendDailySummaryEmail(): Promise<void> {
  const config = getEnvConfig();
  console.log(`[ServiceSummaryScheduler] Sending daily summary email at ${new Date().toLocaleString()}`);
  
  try {
    // Get cached data or fetch fresh
    let data = getCachedServiceHistory();
    
    if (!data) {
      console.log('[ServiceSummaryScheduler] Cache miss - fetching fresh data...');
      await prefetchServiceHistory();
      data = getCachedServiceHistory();
    }
    
    if (!data) {
      console.error('[ServiceSummaryScheduler] ❌ Failed to get service history data');
      return;
    }
    
    // Save to DB for tracking
    const [record] = await db.insert(dailySummaryAcknowledgment).values({
      date: data.date,
      summary: data.summary,
      status: 'pending',
    }).returning();
    
    // Generate acknowledgment link
    const acknowledgmentLink = `${config.appUrl}/api/summary/acknowledge-view/${record.id}`;
    
    // Send email
    await sendEmail({
      to: config.expertTechnicianEmail,
      subject: `Daily Service Request Summary – ${data.date}`,
      body: `Please review the daily summary for ${data.date}. Total Requests: ${data.summary.totalRequests}.`,
      html: generateEmailHtml(data, acknowledgmentLink, false),
    });
    
    console.log(`[ServiceSummaryScheduler] ✅ Daily summary email sent to ${config.expertTechnicianEmail}`);
    console.log(`[ServiceSummaryScheduler] Summary ID: ${record.id}`);
    
  } catch (error) {
    console.error('[ServiceSummaryScheduler] ❌ Error sending daily summary email:', error);
  }
}

/**
 * Check for acknowledgment and escalate to CEO if needed
 */
async function checkAndEscalate(): Promise<void> {
  const config = getEnvConfig();
  console.log(`[ServiceSummaryScheduler] Checking for escalation at ${new Date().toLocaleString()}`);
  
  try {
    const yesterday = subDays(new Date(), 1);
    const targetDate = format(yesterday, 'yyyy-MM-dd');
    
    console.log(`[ServiceSummaryScheduler] Checking acknowledgment for: ${targetDate}`);
    
    const [record] = await db.select().from(dailySummaryAcknowledgment)
      .where(eq(dailySummaryAcknowledgment.date, targetDate))
      .limit(1);
    
    if (!record) {
      console.log(`[ServiceSummaryScheduler] ❌ No summary record found for ${targetDate}`);
      return;
    }
    
    console.log(`[ServiceSummaryScheduler] Record ID: ${record.id}, Status: ${record.status}`);
    
    if (record.status === 'pending') {
      console.log(`[ServiceSummaryScheduler] Status is PENDING - initiating escalation to CEO`);
      
      const summary = record.summary as DailySummary;
      
      // Try to get cached data for full details, or just use summary
      const cachedData = getCachedServiceHistory();
      const emailData: ServiceSummaryData = cachedData || {
        summary,
        serviceRequests: [],
        technicianDetails: [],
        date: summary.date,
      };
      
      const acknowledgmentLink = `${config.appUrl}/api/summary/acknowledge-view/${record.id}`;
      
      try {
        console.log(`[ServiceSummaryScheduler] Sending escalation email to CEO (${config.ceoEmail})...`);
        
        await sendEmail({
          to: config.ceoEmail,
          subject: `ESCALATION: Daily Service Summary Not Acknowledged – ${summary.date}`,
          body: `Daily summary for ${summary.date} was not acknowledged by the expert technician.`,
          html: generateEmailHtml(emailData, acknowledgmentLink, true),
        });
        
        // Also CC the expert technician
        await sendEmail({
          to: config.expertTechnicianEmail,
          subject: `REMINDER: Daily Service Summary Requires Acknowledgment – ${summary.date}`,
          body: `The CEO has been notified that the daily summary was not acknowledged.`,
          html: generateEmailHtml(emailData, acknowledgmentLink, false),
        });
        
        console.log('[ServiceSummaryScheduler] ✅ Escalation email sent successfully');
        
      } catch (emailError: any) {
        console.error('[ServiceSummaryScheduler] ❌ Failed to send escalation email:', emailError);
      }
      
    } else {
      console.log(`[ServiceSummaryScheduler] ✅ Summary already acknowledged at ${record.acknowledgedAt}. No escalation needed.`);
    }
    
  } catch (error) {
    console.error('[ServiceSummaryScheduler] ❌ Error in escalation check:', error);
  }
}

/**
 * Send reminder to expert technician before escalation time if still pending
 */
async function sendReminderIfPending(): Promise<void> {
  const config = getEnvConfig();
  console.log(`[ServiceSummaryScheduler] Checking if reminder is needed at ${new Date().toLocaleString()}`);

  try {
    const yesterday = subDays(new Date(), 1);
    const targetDate = format(yesterday, 'yyyy-MM-dd');

    const [record] = await db.select().from(dailySummaryAcknowledgment)
      .where(eq(dailySummaryAcknowledgment.date, targetDate))
      .limit(1);

    if (!record) {
      console.log(`[ServiceSummaryScheduler] ❌ No summary record found for ${targetDate}, skipping reminder.`);
      return;
    }

    if (record.status !== 'pending') {
      console.log(`[ServiceSummaryScheduler] Reminder not needed. Status: ${record.status}`);
      return;
    }

    const summary = record.summary as DailySummary;
    const cachedData = getCachedServiceHistory();
    const emailData: ServiceSummaryData = cachedData || {
      summary,
      serviceRequests: [],
      technicianDetails: [],
      date: summary.date,
    };

    const acknowledgmentLink = `${config.appUrl}/api/summary/acknowledge-view/${record.id}`;

    await sendEmail({
      to: config.expertTechnicianEmail,
      subject: `REMINDER: Daily Service Summary Requires Acknowledgment – ${summary.date}`,
      body: `Friendly reminder to acknowledge the daily service summary for ${summary.date}.`,
      html: generateEmailHtml(emailData, acknowledgmentLink, false),
    });

    console.log(`[ServiceSummaryScheduler] ✅ Reminder email sent to ${config.expertTechnicianEmail} for ${summary.date}`);
  } catch (error) {
    console.error('[ServiceSummaryScheduler] ❌ Error sending reminder email:', error);
  }
}

/**
 * Acknowledge a summary record
 */
export async function acknowledgeSummary(id: string): Promise<{ message: string; record: any }> {
  const config = getEnvConfig();
  
  const [record] = await db.select().from(dailySummaryAcknowledgment)
    .where(eq(dailySummaryAcknowledgment.id, id))
    .limit(1);
  
  if (!record) {
    throw new Error('Summary not found');
  }
  
  if (record.status === 'acknowledged') {
    return { message: 'Already acknowledged', record };
  }
  
  const [updated] = await db.update(dailySummaryAcknowledgment)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
    })
    .where(eq(dailySummaryAcknowledgment.id, id))
    .returning();
  
  // Send acknowledgment confirmation to CEO
  try {
    const summary = updated.summary as DailySummary;
    const acknowledgedAt = updated.acknowledgedAt
      ? new Date(updated.acknowledgedAt).toLocaleString()
      : new Date().toLocaleString();
    
    await sendEmail({
      to: config.ceoEmail,
      subject: `✅ Daily Summary Acknowledged – ${summary.date}`,
      body: `The expert technician has acknowledged today's service request summary at ${acknowledgedAt}.`,
      html: generateAcknowledgmentEmailHtml(summary, acknowledgedAt),
    });
    
    console.log('[ServiceSummaryScheduler] CEO acknowledgment notification sent');
  } catch (error) {
    console.error('[ServiceSummaryScheduler] Failed to send CEO notification:', error);
  }
  
  return { message: 'Acknowledgment received', record: updated };
}

function generateAcknowledgmentEmailHtml(summary: DailySummary, acknowledgedAt: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2e7d32;">✅ Daily Summary Acknowledged</h2>
      <p>Dear Sir,</p>
      <p>The Daily Service Request Summary for <strong>${summary.date}</strong> has been acknowledged by the Expert Technician at <strong>${acknowledgedAt}</strong>.</p>
      
      <h3 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Summary Overview</h3>
      <ul style="list-style-type: none; padding: 0;">
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Total Requests:</strong> ${summary.totalRequests}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Assigned:</strong> ${summary.assigned}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Completed:</strong> <span style="color: green;">${summary.completed}</span></li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>In Progress:</strong> <span style="color: orange;">${summary.inProgress}</span></li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Pending:</strong> ${summary.pending}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Delayed:</strong> <span style="color: ${summary.delayed > 0 ? 'red' : 'inherit'}">${summary.delayed}</span></li>
      </ul>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Regards,<br>
        Automated Reporting System<br>
        Service Hub
      </p>
    </div>
  `;
}

// Scheduler instance
class ServiceSummaryScheduler {
  private fetchTask: cron.ScheduledTask | null = null;
  private emailTask: cron.ScheduledTask | null = null;
  private escalationTask: cron.ScheduledTask | null = null;
  private reminderTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  
  /**
   * Start the scheduler with configured times from environment variables
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[ServiceSummaryScheduler] ⏭️ Scheduler already running');
      return;
    }
    
    const config = getEnvConfig();
    
    console.log('[ServiceSummaryScheduler] ════════════════════════════════════════════════════');
    console.log('[ServiceSummaryScheduler] 🚀 Starting Service Summary Scheduler...');
    console.log('[ServiceSummaryScheduler] ════════════════════════════════════════════════════');
    console.log('[ServiceSummaryScheduler] Configuration:');
    console.log(`  📦 Service History Fetch Time: ${config.fetchTime}`);
    console.log(`  📧 Service Summary Email Time: ${config.emailTime}`);
    console.log(`  ⚠️  CEO Escalation Time: ${config.escalationTime}`);
    console.log(`  ⏰ Reminder Minutes Before Escalation: ${config.reminderMinutesBeforeEscalation}`);
    console.log(`  👤 Expert Technician Email: ${config.expertTechnicianEmail}`);
    console.log(`  👔 CEO Email: ${config.ceoEmail}`);
    console.log(`  🌐 App URL: ${config.appUrl}`);
    
    // Validate time formats
    const fetchTimeValid = validateTimeFormat(config.fetchTime, 'SERVICE_HISTORY_FETCH_TIME');
    const emailTimeValid = validateTimeFormat(config.emailTime, 'SERVICE_SUMMARY_EMAIL_TIME');
    const escalationTimeValid = validateTimeFormat(config.escalationTime, 'CEO_ESCALATION_TIME');
    
    if (!fetchTimeValid || !emailTimeValid || !escalationTimeValid) {
      console.error('[ServiceSummaryScheduler] ❌ Invalid time format(s) detected! Please use HH:MM format (e.g., 06:00, 16:30)');
    }
    
    // Schedule pre-fetch job
    const fetchCron = timeToCron(config.fetchTime);
    console.log(`[ServiceSummaryScheduler] Scheduling data fetch: ${fetchCron} (${config.fetchTime})`);
    this.fetchTask = cron.schedule(fetchCron, async () => {
      console.log(`[ServiceSummaryScheduler] ⏰ Data fetch job triggered at ${new Date().toLocaleString()}`);
      await prefetchServiceHistory();
    });
    
    // Schedule email job
    const emailCron = timeToCron(config.emailTime);
    console.log(`[ServiceSummaryScheduler] Scheduling email send: ${emailCron} (${config.emailTime})`);
    this.emailTask = cron.schedule(emailCron, async () => {
      console.log(`[ServiceSummaryScheduler] ⏰ Email send job triggered at ${new Date().toLocaleString()}`);
      await sendDailySummaryEmail();
    });
    
    // Schedule reminder before escalation (if time stays on same day)
    if (escalationTimeValid && Number.isFinite(config.reminderMinutesBeforeEscalation)) {
      const reminderTime = subtractMinutesFromTime(config.escalationTime, config.reminderMinutesBeforeEscalation);
      if (!reminderTime) {
        console.warn(`[ServiceSummaryScheduler] ⚠️ Reminder not scheduled because ${config.reminderMinutesBeforeEscalation} minutes before escalation (${config.escalationTime}) would roll to the previous day. Adjust times or reminder offset.`);
      } else if (validateTimeFormat(reminderTime, 'SUMMARY_REMINDER_TIME')) {
        const reminderCron = timeToCron(reminderTime);
        console.log(`[ServiceSummaryScheduler] Scheduling reminder: ${reminderCron} (${reminderTime})`);
        this.reminderTask = cron.schedule(reminderCron, async () => {
          console.log(`[ServiceSummaryScheduler] ⏰ Reminder job triggered at ${new Date().toLocaleString()}`);
          await sendReminderIfPending();
        });
      }
    }

    // Schedule escalation check job
    const escalationCron = timeToCron(config.escalationTime);
    console.log(`[ServiceSummaryScheduler] Scheduling escalation check: ${escalationCron} (${config.escalationTime})`);
    this.escalationTask = cron.schedule(escalationCron, async () => {
      console.log(`[ServiceSummaryScheduler] ⏰ Escalation check job triggered at ${new Date().toLocaleString()}`);
      await checkAndEscalate();
    });
    
    this.isRunning = true;
    console.log('[ServiceSummaryScheduler] ✅ All jobs scheduled successfully');
  }
  
  /**
   * Stop all scheduled jobs
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[ServiceSummaryScheduler] ⏭️ Scheduler not running');
      return;
    }
    
    console.log('[ServiceSummaryScheduler] 🛑 Stopping scheduler...');
    
    if (this.fetchTask) {
      this.fetchTask.stop();
      this.fetchTask = null;
    }
    
    if (this.emailTask) {
      this.emailTask.stop();
      this.emailTask = null;
    }
    
    if (this.reminderTask) {
      this.reminderTask.stop();
      this.reminderTask = null;
    }
    
    if (this.escalationTask) {
      this.escalationTask.stop();
      this.escalationTask = null;
    }
    
    this.isRunning = false;
    console.log('[ServiceSummaryScheduler] ✅ Scheduler stopped');
  }
  
  /**
   * Get scheduler status
   */
  public getStatus() {
    const config = getEnvConfig();
    return {
      isRunning: this.isRunning,
      config: {
        fetchTime: config.fetchTime,
        emailTime: config.emailTime,
        escalationTime: config.escalationTime,
        expertTechnicianEmail: config.expertTechnicianEmail,
        ceoEmail: config.ceoEmail,
      },
      cache: cachedServiceHistory ? {
        date: cachedServiceHistory.date,
        fetchedAt: cachedServiceHistory.fetchedAt,
        hasData: !!cachedServiceHistory.data,
      } : null,
    };
  }
  
  /**
   * Manually trigger prefetch (for testing)
   */
  public async triggerPrefetch(): Promise<void> {
    console.log('[ServiceSummaryScheduler] 🔄 Manually triggering prefetch...');
    await prefetchServiceHistory();
  }
  
  /**
   * Manually trigger email send (for testing)
   */
  public async triggerEmailSend(): Promise<void> {
    console.log('[ServiceSummaryScheduler] 🔄 Manually triggering email send...');
    await sendDailySummaryEmail();
  }
  
  /**
   * Manually trigger escalation check (for testing)
   */
  public async triggerEscalationCheck(): Promise<void> {
    console.log('[ServiceSummaryScheduler] 🔄 Manually triggering escalation check...');
    await checkAndEscalate();
  }
  
  /**
   * Clear cache (for testing)
   */
  public clearCache(): void {
    console.log('[ServiceSummaryScheduler] 🗑️ Clearing cache...');
    cachedServiceHistory = null;
  }
}

// Singleton instance
let schedulerInstance: ServiceSummaryScheduler | null = null;

/**
 * Get or create the service summary scheduler
 */
export function getServiceSummaryScheduler(): ServiceSummaryScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ServiceSummaryScheduler();
  }
  return schedulerInstance;
}

/**
 * Start the service summary scheduler
 */
export function startServiceSummaryScheduler(): void {
  const scheduler = getServiceSummaryScheduler();
  scheduler.start();
}

/**
 * Stop the service summary scheduler
 */
export function stopServiceSummaryScheduler(): void {
  const scheduler = getServiceSummaryScheduler();
  scheduler.stop();
}

export { ServiceSummaryScheduler, prefetchServiceHistory, sendDailySummaryEmail, checkAndEscalate };


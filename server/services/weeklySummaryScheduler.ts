import cron from 'node-cron';
import { db } from '../db';
import { serviceRequests, weeklySummaryReports, technicians, customers, containers } from '@shared/schema';
import { sendEmail } from './emailService';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { subDays, startOfDay, endOfDay, format, startOfWeek, endOfWeek, getISOWeek, getYear, previousFriday, isFriday, addDays } from 'date-fns';

/**
 * Weekly Summary Scheduler - CAPA Report for Reefer
 * 
 * Sends a detailed weekly summary report to CEO and Senior Technician
 * every Friday at configured time (default 13:00 IST).
 * 
 * Environment Variables:
 * - WEEKLY_SUMMARY_TIME: Time to send weekly summary (HH:MM format, default "13:00")
 * - WEEKLY_SUMMARY_DAY: Day of week to send (0=Sunday, 5=Friday, default "5")
 * - EXPERT_TECHNICIAN_EMAIL: Email of senior technician (required)
 * - CEO_EMAIL: Email of CEO (required)
 */

// Interfaces
interface WeeklySummaryData {
  summary: WeeklySummary;
  serviceRequests: any[];
  technicianPerformance: TechnicianPerformance[];
  weekStartDate: string;
  weekEndDate: string;
  weekIdentifier: string;
}

interface WeeklySummary {
  totalRequests: number;
  assigned: number;
  technicianAssigned: number;
  inProgress: number;
  technicianStarted: number;
  completed: number;
  delayed: number;
  pending: number;
  cancelled: number;
  averageCompletionTimeHours: number;
  onTimeCompletionRate: number;
  weekStartDate: string;
  weekEndDate: string;
}

interface TechnicianPerformance {
  technicianId: string;
  technicianName: string;
  employeeCode: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
}

interface ServiceRequestDetail {
  requestNumber: string;
  customerName: string;
  containerCode: string;
  status: string;
  serviceType: string;
  priority: string;
  technicianName: string;
  scheduledDate: string;
  completedDate: string | null;
  issueDescription: string;
  resolutionNotes: string | null;
}

// Environment configuration
function getWeeklyEnvConfig() {
  return {
    weeklyTime: process.env.WEEKLY_SUMMARY_TIME || '13:00', // Default 1:00 PM
    weeklyDay: parseInt(process.env.WEEKLY_SUMMARY_DAY || '5', 10), // Default Friday (5)
    expertTechnicianEmail: process.env.EXPERT_TECHNICIAN_EMAIL || 'chavandhiksha212@gmail.com',
    ceoEmail: process.env.CEO_EMAIL || 'chavandhiksha2003@gmail.com',
    appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000',
  };
}

// Validate time format (HH:MM)
function validateTimeFormat(time: string, varName: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(time)) {
    console.error(`[WeeklySummaryScheduler] ❌ Invalid time format for ${varName}: "${time}". Expected HH:MM (24-hour format)`);
    return false;
  }
  return true;
}

// Convert HH:MM and day to cron expression
function weeklyTimeToCron(time: string, dayOfWeek: number): string {
  const [hour, minute] = time.split(':').map(Number);
  // Cron: minute hour * * dayOfWeek (0=Sunday, 5=Friday)
  const cronExpr = `${minute} ${hour} * * ${dayOfWeek}`;
  console.log(`[WeeklySummaryScheduler] Time "${time}" on day ${dayOfWeek} → Cron: "${cronExpr}"`);
  return cronExpr;
}

/**
 * Get the week identifier (e.g., "2025-W51") for a given date
 */
function getWeekIdentifier(date: Date): string {
  const year = getYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Calculate week boundaries (Monday to Friday for business week)
 */
function getWeekBoundaries(referenceDate: Date = new Date()): { start: Date; end: Date } {
  // Get the start of the current week (Monday)
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }); // 1 = Monday
  // End on Friday (4 days after Monday)
  const weekEnd = addDays(weekStart, 4);
  
  return {
    start: startOfDay(weekStart),
    end: endOfDay(weekEnd),
  };
}

/**
 * Check if a weekly report has already been sent for the given week
 */
async function isWeeklyReportAlreadySent(weekIdentifier: string): Promise<boolean> {
  try {
    const existing = await db.select().from(weeklySummaryReports)
      .where(eq(weeklySummaryReports.weekIdentifier, weekIdentifier))
      .limit(1);
    
    return existing.length > 0;
  } catch (error) {
    console.error('[WeeklySummaryScheduler] Error checking for existing report:', error);
    return false;
  }
}

/**
 * Fetch all service requests for the week
 */
async function fetchWeeklyServiceRequests(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    const requests = await db.query.serviceRequests.findMany({
      where: and(
        gte(serviceRequests.createdAt, startDate),
        lte(serviceRequests.createdAt, endDate)
      ),
    });
    
    // Enrich with customer, container, and technician info
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        let customer = null;
        let container = null;
        let technician = null;
        
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
        
        if (req.assignedTechnicianId) {
          technician = await db.query.technicians.findFirst({
            where: eq(technicians.id, req.assignedTechnicianId),
          });
        }
        
        return {
          ...req,
          customerName: customer?.companyName || 'Unknown Customer',
          containerCode: container?.containerCode || 'N/A',
          technicianName: technician?.name || technician?.employeeCode || 'Unassigned',
        };
      })
    );
    
    return enrichedRequests;
  } catch (error) {
    console.error('[WeeklySummaryScheduler] Error fetching service requests:', error);
    return [];
  }
}

/**
 * Calculate technician performance for the week
 */
async function calculateTechnicianPerformance(requests: any[]): Promise<TechnicianPerformance[]> {
  // Group requests by technician
  const technicianMap = new Map<string, any[]>();
  
  for (const req of requests) {
    if (req.assignedTechnicianId) {
      if (!technicianMap.has(req.assignedTechnicianId)) {
        technicianMap.set(req.assignedTechnicianId, []);
      }
      technicianMap.get(req.assignedTechnicianId)!.push(req);
    }
  }
  
  // Calculate performance for each technician
  const performances: TechnicianPerformance[] = [];
  
  for (const [techId, techRequests] of technicianMap) {
    const tech = await db.query.technicians.findFirst({
      where: eq(technicians.id, techId),
    });
    
    if (!tech) continue;
    
    const completed = techRequests.filter(r => r.status === 'completed').length;
    const inProgress = techRequests.filter(r => r.status === 'in_progress').length;
    const pending = techRequests.filter(r => r.status === 'pending').length;
    
    performances.push({
      technicianId: techId,
      technicianName: tech.name || 'Unknown',
      employeeCode: tech.employeeCode || 'N/A',
      totalAssigned: techRequests.length,
      completed,
      inProgress,
      pending,
      completionRate: techRequests.length > 0 ? Math.round((completed / techRequests.length) * 100) : 0,
    });
  }
  
  // Sort by completion rate descending
  return performances.sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Generate weekly summary statistics
 */
function generateWeeklySummary(requests: any[], weekStart: string, weekEnd: string): WeeklySummary {
  const summary: WeeklySummary = {
    totalRequests: requests.length,
    assigned: 0,
    technicianAssigned: 0,
    inProgress: 0,
    technicianStarted: 0,
    completed: 0,
    delayed: 0,
    pending: 0,
    cancelled: 0,
    averageCompletionTimeHours: 0,
    onTimeCompletionRate: 0,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
  };
  
  let totalCompletionTime = 0;
  let completedWithTime = 0;
  let onTimeCompletions = 0;
  
  for (const req of requests) {
    if (req.status === 'pending') summary.pending++;
    if (req.status === 'cancelled') summary.cancelled++;
    if (['approved', 'scheduled', 'in_progress', 'completed'].includes(req.status || '')) {
      summary.assigned++;
    }
    if (req.assignedTechnicianId) summary.technicianAssigned++;
    if (req.status === 'in_progress') summary.inProgress++;
    if (req.actualStartTime) summary.technicianStarted++;
    if (req.status === 'completed') {
      summary.completed++;
      
      // Calculate completion time
      if (req.actualEndTime && req.actualStartTime) {
        const startTime = new Date(req.actualStartTime);
        const endTime = new Date(req.actualEndTime);
        const completionTimeHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        totalCompletionTime += completionTimeHours;
        completedWithTime++;
      }
      
      // Check if completed on time
      if (req.scheduledDate && req.actualEndTime) {
        const scheduledDate = new Date(req.scheduledDate);
        const actualEndTime = new Date(req.actualEndTime);
        if (actualEndTime <= scheduledDate) {
          onTimeCompletions++;
        }
      }
    }
    
    // Check if delayed
    if (req.scheduledDate && new Date(req.scheduledDate) < new Date() && req.status !== 'completed') {
      summary.delayed++;
    }
  }
  
  // Calculate averages
  if (completedWithTime > 0) {
    summary.averageCompletionTimeHours = Math.round((totalCompletionTime / completedWithTime) * 10) / 10;
  }
  
  if (summary.completed > 0) {
    summary.onTimeCompletionRate = Math.round((onTimeCompletions / summary.completed) * 100);
  }
  
  return summary;
}

/**
 * Generate detailed paragraph-format report for CEO
 */
function generateDetailedReport(data: WeeklySummaryData): string {
  const { summary, serviceRequests: requests, technicianPerformance, weekStartDate, weekEndDate } = data;
  
  // Format date range
  const startFormatted = format(new Date(weekStartDate), 'MMMM d, yyyy');
  const endFormatted = format(new Date(weekEndDate), 'MMMM d, yyyy');
  
  let report = `WEEKLY SERVICE OPERATIONS REPORT\n`;
  report += `Period: ${startFormatted} to ${endFormatted}\n`;
  report += `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}\n\n`;
  
  // Executive Summary
  report += `EXECUTIVE SUMMARY\n`;
  report += `=================\n\n`;
  
  report += `During the reporting period from ${startFormatted} to ${endFormatted}, the service operations team handled a total of ${summary.totalRequests} service requests. `;
  
  if (summary.totalRequests > 0) {
    const completionRate = Math.round((summary.completed / summary.totalRequests) * 100);
    report += `Of these, ${summary.completed} requests (${completionRate}%) were successfully completed, while ${summary.inProgress} remain in progress and ${summary.pending} are pending assignment or action. `;
    
    if (summary.delayed > 0) {
      report += `Notably, ${summary.delayed} service requests are currently delayed beyond their scheduled completion dates, requiring immediate attention. `;
    } else {
      report += `All active service requests are within their scheduled timelines. `;
    }
    
    if (summary.cancelled > 0) {
      report += `${summary.cancelled} requests were cancelled during this period. `;
    }
  } else {
    report += `No new service requests were recorded during this period. `;
  }
  
  report += `\n\n`;
  
  // Operations Performance
  report += `OPERATIONS PERFORMANCE\n`;
  report += `======================\n\n`;
  
  report += `The team achieved a ${summary.onTimeCompletionRate}% on-time completion rate for resolved service requests. `;
  
  if (summary.averageCompletionTimeHours > 0) {
    report += `The average time to complete a service request was ${summary.averageCompletionTimeHours} hours. `;
  }
  
  report += `${summary.technicianAssigned} out of ${summary.totalRequests} requests had technicians assigned, indicating a ${summary.totalRequests > 0 ? Math.round((summary.technicianAssigned / summary.totalRequests) * 100) : 0}% assignment rate. `;
  report += `${summary.technicianStarted} technicians have commenced work on their assigned tasks.\n\n`;
  
  // Technician Performance Summary
  if (technicianPerformance.length > 0) {
    report += `TECHNICIAN PERFORMANCE\n`;
    report += `======================\n\n`;
    
    for (const tech of technicianPerformance) {
      report += `${tech.technicianName} (${tech.employeeCode}): Assigned ${tech.totalAssigned} tasks, completed ${tech.completed} (${tech.completionRate}% completion rate), with ${tech.inProgress} in progress and ${tech.pending} pending.\n`;
    }
    report += `\n`;
    
    // Top performer
    if (technicianPerformance.length > 0 && technicianPerformance[0].completionRate > 0) {
      const topPerformer = technicianPerformance[0];
      report += `Top performer this week: ${topPerformer.technicianName} with a ${topPerformer.completionRate}% completion rate.\n\n`;
    }
  }
  
  // Issues Requiring Attention
  const delayedRequests = requests.filter(r => {
    if (r.scheduledDate && r.status !== 'completed' && r.status !== 'cancelled') {
      return new Date(r.scheduledDate) < new Date();
    }
    return false;
  });
  
  if (delayedRequests.length > 0) {
    report += `ISSUES REQUIRING ATTENTION\n`;
    report += `==========================\n\n`;
    
    report += `The following ${delayedRequests.length} service request(s) are delayed and require immediate attention:\n\n`;
    
    for (const req of delayedRequests.slice(0, 10)) { // Limit to 10 for readability
      const scheduledDate = req.scheduledDate ? format(new Date(req.scheduledDate), 'MMM d, yyyy') : 'Not scheduled';
      report += `- Request #${req.requestNumber || 'N/A'} for ${req.customerName} (Container: ${req.containerCode})\n`;
      report += `  Status: ${(req.status || 'pending').toUpperCase()}, Scheduled: ${scheduledDate}\n`;
      report += `  Assigned to: ${req.technicianName}\n`;
      if (req.issueDescription) {
        report += `  Issue: ${req.issueDescription.substring(0, 100)}${req.issueDescription.length > 100 ? '...' : ''}\n`;
      }
      report += `\n`;
    }
    
    if (delayedRequests.length > 10) {
      report += `...and ${delayedRequests.length - 10} more delayed requests.\n\n`;
    }
  }
  
  // Completed Work Summary
  const completedRequests = requests.filter(r => r.status === 'completed');
  if (completedRequests.length > 0) {
    report += `COMPLETED SERVICE REQUESTS\n`;
    report += `==========================\n\n`;
    
    report += `A total of ${completedRequests.length} service requests were successfully completed this week:\n\n`;
    
    for (const req of completedRequests.slice(0, 15)) { // Limit to 15
      const completedDate = req.actualEndTime ? format(new Date(req.actualEndTime), 'MMM d, yyyy') : 'N/A';
      report += `- Request #${req.requestNumber || 'N/A'}: ${req.customerName} (Container: ${req.containerCode})\n`;
      report += `  Completed on ${completedDate} by ${req.technicianName}\n`;
      if (req.resolutionNotes) {
        report += `  Resolution: ${req.resolutionNotes.substring(0, 150)}${req.resolutionNotes.length > 150 ? '...' : ''}\n`;
      }
      report += `\n`;
    }
    
    if (completedRequests.length > 15) {
      report += `...and ${completedRequests.length - 15} more completed requests.\n\n`;
    }
  }
  
  // Closing
  report += `RECOMMENDATIONS\n`;
  report += `===============\n\n`;
  
  if (summary.delayed > 0) {
    report += `1. Prioritize the ${summary.delayed} delayed service requests to improve customer satisfaction.\n`;
  }
  if (summary.pending > 0) {
    report += `${summary.delayed > 0 ? '2' : '1'}. Review and assign the ${summary.pending} pending requests to available technicians.\n`;
  }
  if (summary.onTimeCompletionRate < 80 && summary.completed > 0) {
    report += `${(summary.delayed > 0 ? 2 : 1) + (summary.pending > 0 ? 1 : 0)}. Focus on improving the on-time completion rate (currently at ${summary.onTimeCompletionRate}%).\n`;
  }
  if (summary.delayed === 0 && summary.pending === 0 && summary.onTimeCompletionRate >= 80) {
    report += `The team has performed well this week. Continue maintaining current service levels.\n`;
  }
  
  report += `\n---\nThis report was automatically generated by Service Hub.\n`;
  report += `For questions or concerns, please contact the operations team.\n`;
  
  return report;
}

/**
 * Generate HTML email for weekly summary
 */
function generateWeeklyEmailHtml(data: WeeklySummaryData): string {
  const { summary, technicianPerformance, weekStartDate, weekEndDate, serviceRequests: requests } = data;
  
  const startFormatted = format(new Date(weekStartDate), 'MMMM d, yyyy');
  const endFormatted = format(new Date(weekEndDate), 'MMMM d, yyyy');
  
  // Calculate some key metrics
  const completionRate = summary.totalRequests > 0 ? Math.round((summary.completed / summary.totalRequests) * 100) : 0;
  const assignmentRate = summary.totalRequests > 0 ? Math.round((summary.technicianAssigned / summary.totalRequests) * 100) : 0;
  
  // Get delayed requests
  const delayedRequests = requests.filter(r => {
    if (r.scheduledDate && r.status !== 'completed' && r.status !== 'cancelled') {
      return new Date(r.scheduledDate) < new Date();
    }
    return false;
  });
  
  // Build technician table
  let technicianTable = '';
  if (technicianPerformance.length > 0) {
    technicianTable = `
      <h3 style="color: #1a237e; margin-top: 25px; border-bottom: 2px solid #1a237e; padding-bottom: 8px;">
        👨‍🔧 Technician Performance
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr style="background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white;">
          <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Technician</th>
          <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Assigned</th>
          <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Completed</th>
          <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">In Progress</th>
          <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Rate</th>
        </tr>
        ${technicianPerformance.map((t, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
            <td style="padding: 12px; border: 1px solid #ddd;">
              <strong>${t.technicianName}</strong>
              <br><span style="color: #666; font-size: 12px;">${t.employeeCode}</span>
            </td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${t.totalAssigned}</td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #2e7d32; font-weight: bold;">${t.completed}</td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #f57c00;">${t.inProgress}</td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
              <span style="background-color: ${t.completionRate >= 80 ? '#e8f5e9' : t.completionRate >= 50 ? '#fff3e0' : '#ffebee'}; 
                          color: ${t.completionRate >= 80 ? '#2e7d32' : t.completionRate >= 50 ? '#ef6c00' : '#c62828'}; 
                          padding: 4px 8px; border-radius: 12px; font-weight: bold;">
                ${t.completionRate}%
              </span>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  // Build delayed requests alert
  let delayedAlert = '';
  if (delayedRequests.length > 0) {
    delayedAlert = `
      <div style="margin: 25px 0; padding: 20px; background-color: #fff3e0; border-left: 5px solid #ff9800; border-radius: 4px;">
        <h4 style="margin: 0 0 15px 0; color: #e65100;">
          ⚠️ ${delayedRequests.length} Delayed Service Request(s) Requiring Attention
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="background-color: #fff8e1;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ffcc80;">Request</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ffcc80;">Customer</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ffcc80;">Container</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ffcc80;">Scheduled</th>
          </tr>
          ${delayedRequests.slice(0, 5).map(r => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ffe0b2;">${r.requestNumber || 'N/A'}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ffe0b2;">${r.customerName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ffe0b2;">${r.containerCode}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ffe0b2;">${r.scheduledDate ? format(new Date(r.scheduledDate), 'MMM d, yyyy') : 'N/A'}</td>
            </tr>
          `).join('')}
        </table>
        ${delayedRequests.length > 5 ? `<p style="margin: 10px 0 0 0; color: #e65100; font-size: 12px;">...and ${delayedRequests.length - 5} more delayed requests</p>` : ''}
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">📊 Weekly CAPA Report</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Reefer Service Operations Summary</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${startFormatted} – ${endFormatted}</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Executive Summary -->
        <div style="background: linear-gradient(to right, #e3f2fd, #f3e5f5); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px 0; color: #1a237e;">📋 Executive Summary</h3>
          <p style="margin: 0; color: #424242; font-size: 15px;">
            During the reporting period from <strong>${startFormatted}</strong> to <strong>${endFormatted}</strong>, 
            the service operations team processed <strong>${summary.totalRequests}</strong> service requests. 
            ${summary.completed > 0 ? `<strong>${summary.completed}</strong> requests (${completionRate}%) were successfully completed` : 'No requests were completed'}, 
            ${summary.inProgress > 0 ? `<strong>${summary.inProgress}</strong> remain in progress` : 'none are in progress'}, 
            and <strong>${summary.pending}</strong> are pending.
            ${summary.delayed > 0 ? ` <span style="color: #d32f2f;"><strong>${summary.delayed}</strong> requests are currently delayed.</span>` : ' All active requests are on schedule.'}
          </p>
        </div>
        
        <!-- Key Metrics Grid -->
        <h3 style="color: #1a237e; margin-top: 25px; border-bottom: 2px solid #1a237e; padding-bottom: 8px;">
          📈 Key Performance Metrics
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="width: 25%; padding: 15px; text-align: center; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 8px; margin: 5px;">
              <div style="font-size: 32px; font-weight: bold; color: #1565c0;">${summary.totalRequests}</div>
              <div style="font-size: 12px; color: #1976d2; text-transform: uppercase; letter-spacing: 1px;">Total Requests</div>
            </td>
            <td style="width: 25%; padding: 15px; text-align: center; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #2e7d32;">${summary.completed}</div>
              <div style="font-size: 12px; color: #388e3c; text-transform: uppercase; letter-spacing: 1px;">Completed</div>
            </td>
            <td style="width: 25%; padding: 15px; text-align: center; background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #ef6c00;">${summary.inProgress}</div>
              <div style="font-size: 12px; color: #f57c00; text-transform: uppercase; letter-spacing: 1px;">In Progress</div>
            </td>
            <td style="width: 25%; padding: 15px; text-align: center; background: linear-gradient(135deg, ${summary.delayed > 0 ? '#ffebee 0%, #ffcdd2 100%' : '#f5f5f5 0%, #eeeeee 100%'}); border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: ${summary.delayed > 0 ? '#c62828' : '#757575'};">${summary.delayed}</div>
              <div style="font-size: 12px; color: ${summary.delayed > 0 ? '#d32f2f' : '#9e9e9e'}; text-transform: uppercase; letter-spacing: 1px;">Delayed</div>
            </td>
          </tr>
        </table>
        
        <!-- Detailed Metrics Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: left;">Metric</th>
            <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: right;">Value</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e0e0e0;">Technicians Assigned</td>
            <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: right; font-weight: bold;">${summary.technicianAssigned} (${assignmentRate}%)</td>
          </tr>
          <tr style="background-color: #fafafa;">
            <td style="padding: 12px; border: 1px solid #e0e0e0;">On-Time Completion Rate</td>
            <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: ${summary.onTimeCompletionRate >= 80 ? '#2e7d32' : summary.onTimeCompletionRate >= 50 ? '#f57c00' : '#c62828'};">
              ${summary.onTimeCompletionRate}%
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e0e0e0;">Avg. Completion Time</td>
            <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: right; font-weight: bold;">${summary.averageCompletionTimeHours} hours</td>
          </tr>
          <tr style="background-color: #fafafa;">
            <td style="padding: 12px; border: 1px solid #e0e0e0;">Pending Requests</td>
            <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: right; font-weight: bold;">${summary.pending}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e0e0e0;">Cancelled Requests</td>
            <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: right;">${summary.cancelled}</td>
          </tr>
        </table>
        
        ${delayedAlert}
        
        ${technicianTable}
        
        <!-- Recommendations -->
        <div style="margin-top: 25px; padding: 20px; background-color: #e8f5e9; border-radius: 8px; border-left: 5px solid #4caf50;">
          <h4 style="margin: 0 0 15px 0; color: #2e7d32;">💡 Recommendations</h4>
          <ul style="margin: 0; padding-left: 20px; color: #1b5e20;">
            ${summary.delayed > 0 ? `<li style="margin-bottom: 8px;">Prioritize the <strong>${summary.delayed}</strong> delayed service request(s) to improve customer satisfaction.</li>` : ''}
            ${summary.pending > 0 ? `<li style="margin-bottom: 8px;">Review and assign the <strong>${summary.pending}</strong> pending request(s) to available technicians.</li>` : ''}
            ${summary.onTimeCompletionRate < 80 && summary.completed > 0 ? `<li style="margin-bottom: 8px;">Focus on improving the on-time completion rate (currently at <strong>${summary.onTimeCompletionRate}%</strong>).</li>` : ''}
            ${summary.delayed === 0 && summary.pending === 0 && summary.onTimeCompletionRate >= 80 ? `<li>The team has performed excellently this week. Continue maintaining current service levels.</li>` : ''}
          </ul>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center; color: #757575; font-size: 12px;">
          <p style="margin: 0;">This is an automated weekly report from <strong>Service Hub</strong></p>
          <p style="margin: 5px 0;">Generated on ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}</p>
          <p style="margin: 10px 0 0 0; color: #9e9e9e;">For questions, please contact the operations team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send the weekly summary email to CEO and Senior Technician
 */
async function sendWeeklySummaryEmail(): Promise<void> {
  const config = getWeeklyEnvConfig();
  console.log(`[WeeklySummaryScheduler] ════════════════════════════════════════════════════`);
  console.log(`[WeeklySummaryScheduler] 📧 Initiating weekly summary email at ${new Date().toLocaleString()}`);
  
  try {
    // Calculate week boundaries (current week's Monday to Friday)
    const { start, end } = getWeekBoundaries();
    const weekStartDate = format(start, 'yyyy-MM-dd');
    const weekEndDate = format(end, 'yyyy-MM-dd');
    const weekIdentifier = getWeekIdentifier(new Date());
    
    console.log(`[WeeklySummaryScheduler] Week: ${weekIdentifier} (${weekStartDate} to ${weekEndDate})`);
    
    // Check for idempotency - don't send if already sent for this week
    const alreadySent = await isWeeklyReportAlreadySent(weekIdentifier);
    if (alreadySent) {
      console.log(`[WeeklySummaryScheduler] ⏭️ Weekly report for ${weekIdentifier} already sent. Skipping.`);
      return;
    }
    
    // Fetch all service requests for the week
    console.log(`[WeeklySummaryScheduler] Fetching service requests...`);
    const requests = await fetchWeeklyServiceRequests(start, end);
    console.log(`[WeeklySummaryScheduler] Found ${requests.length} service requests`);
    
    // Calculate technician performance
    console.log(`[WeeklySummaryScheduler] Calculating technician performance...`);
    const technicianPerformance = await calculateTechnicianPerformance(requests);
    console.log(`[WeeklySummaryScheduler] ${technicianPerformance.length} technicians analyzed`);
    
    // Generate summary
    const summary = generateWeeklySummary(requests, weekStartDate, weekEndDate);
    
    // Create the data object
    const data: WeeklySummaryData = {
      summary,
      serviceRequests: requests,
      technicianPerformance,
      weekStartDate,
      weekEndDate,
      weekIdentifier,
    };
    
    // Generate detailed report (text format)
    const detailedReport = generateDetailedReport(data);
    
    // Generate HTML email
    const emailHtml = generateWeeklyEmailHtml(data);
    
    // Recipients
    const recipients = [config.ceoEmail, config.expertTechnicianEmail];
    
    // Send emails
    console.log(`[WeeklySummaryScheduler] Sending emails to: ${recipients.join(', ')}`);
    
    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient,
          subject: `📊 Weekly CAPA Report – Reefer Service Operations (${weekStartDate} to ${weekEndDate})`,
          body: detailedReport,
          html: emailHtml,
        });
        console.log(`[WeeklySummaryScheduler] ✅ Email sent to ${recipient}`);
      } catch (emailError) {
        console.error(`[WeeklySummaryScheduler] ❌ Failed to send email to ${recipient}:`, emailError);
      }
    }
    
    // Save to database for tracking (idempotency)
    await db.insert(weeklySummaryReports).values({
      weekStartDate,
      weekEndDate,
      weekIdentifier,
      summary: summary as any,
      detailedReport,
      sentTo: recipients as any,
      status: 'sent',
    });
    
    console.log(`[WeeklySummaryScheduler] ✅ Weekly summary report saved to database`);
    console.log(`[WeeklySummaryScheduler] ════════════════════════════════════════════════════`);
    
  } catch (error) {
    console.error('[WeeklySummaryScheduler] ❌ Error sending weekly summary:', error);
    
    // Try to save failed attempt to database
    try {
      const { start, end } = getWeekBoundaries();
      await db.insert(weeklySummaryReports).values({
        weekStartDate: format(start, 'yyyy-MM-dd'),
        weekEndDate: format(end, 'yyyy-MM-dd'),
        weekIdentifier: getWeekIdentifier(new Date()),
        summary: { error: 'Failed to generate summary' } as any,
        detailedReport: `Error: ${error}`,
        sentTo: [] as any,
        status: 'failed',
      });
    } catch (dbError) {
      console.error('[WeeklySummaryScheduler] Failed to save error record:', dbError);
    }
  }
}

// Scheduler class
class WeeklySummaryScheduler {
  private weeklyTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  
  public start(): void {
    if (this.isRunning) {
      console.log('[WeeklySummaryScheduler] ⏭️ Scheduler already running');
      return;
    }
    
    const config = getWeeklyEnvConfig();
    
    console.log('[WeeklySummaryScheduler] ════════════════════════════════════════════════════');
    console.log('[WeeklySummaryScheduler] 🚀 Starting Weekly Summary Scheduler...');
    console.log('[WeeklySummaryScheduler] ════════════════════════════════════════════════════');
    console.log('[WeeklySummaryScheduler] Configuration:');
    console.log(`  📅 Weekly Summary Time: ${config.weeklyTime}`);
    console.log(`  📆 Weekly Summary Day: ${config.weeklyDay} (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)`);
    console.log(`  👤 Senior Technician Email: ${config.expertTechnicianEmail}`);
    console.log(`  👔 CEO Email: ${config.ceoEmail}`);
    console.log(`  🌐 App URL: ${config.appUrl}`);
    
    // Validate time format
    const timeValid = validateTimeFormat(config.weeklyTime, 'WEEKLY_SUMMARY_TIME');
    if (!timeValid) {
      console.error('[WeeklySummaryScheduler] ❌ Invalid time format! Using default 13:00');
    }
    
    // Validate day of week
    if (config.weeklyDay < 0 || config.weeklyDay > 6) {
      console.error('[WeeklySummaryScheduler] ❌ Invalid day of week! Must be 0-6. Using default 5 (Friday)');
    }
    
    const dayOfWeek = config.weeklyDay >= 0 && config.weeklyDay <= 6 ? config.weeklyDay : 5;
    const time = timeValid ? config.weeklyTime : '13:00';
    
    // Schedule weekly job
    const weeklyCron = weeklyTimeToCron(time, dayOfWeek);
    console.log(`[WeeklySummaryScheduler] Scheduling weekly summary: ${weeklyCron}`);
    
    this.weeklyTask = cron.schedule(weeklyCron, async () => {
      console.log(`[WeeklySummaryScheduler] ⏰ Weekly summary job triggered at ${new Date().toLocaleString()}`);
      await sendWeeklySummaryEmail();
    });
    
    this.isRunning = true;
    console.log('[WeeklySummaryScheduler] ✅ Weekly summary scheduler started successfully');
  }
  
  public stop(): void {
    if (!this.isRunning) {
      console.log('[WeeklySummaryScheduler] ⏭️ Scheduler not running');
      return;
    }
    
    console.log('[WeeklySummaryScheduler] 🛑 Stopping scheduler...');
    
    if (this.weeklyTask) {
      this.weeklyTask.stop();
      this.weeklyTask = null;
    }
    
    this.isRunning = false;
    console.log('[WeeklySummaryScheduler] ✅ Scheduler stopped');
  }
  
  public getStatus() {
    const config = getWeeklyEnvConfig();
    return {
      isRunning: this.isRunning,
      config: {
        weeklyTime: config.weeklyTime,
        weeklyDay: config.weeklyDay,
        expertTechnicianEmail: config.expertTechnicianEmail,
        ceoEmail: config.ceoEmail,
      },
    };
  }
  
  /**
   * Manually trigger weekly summary (for testing)
   */
  public async triggerWeeklySummary(): Promise<void> {
    console.log('[WeeklySummaryScheduler] 🔄 Manually triggering weekly summary...');
    await sendWeeklySummaryEmail();
  }
}

// Singleton instance
let weeklySchedulerInstance: WeeklySummaryScheduler | null = null;

export function getWeeklySummaryScheduler(): WeeklySummaryScheduler {
  if (!weeklySchedulerInstance) {
    weeklySchedulerInstance = new WeeklySummaryScheduler();
  }
  return weeklySchedulerInstance;
}

export function startWeeklySummaryScheduler(): void {
  const scheduler = getWeeklySummaryScheduler();
  scheduler.start();
}

export function stopWeeklySummaryScheduler(): void {
  const scheduler = getWeeklySummaryScheduler();
  scheduler.stop();
}

export { WeeklySummaryScheduler, sendWeeklySummaryEmail };


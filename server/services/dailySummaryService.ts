import { db } from "../db";
import { serviceRequests, dailySummaryAcknowledgment } from "@shared/schema";
import { sendEmail } from "./emailService";
import { eq, and, gte, lte, sql, desc, isNotNull } from "drizzle-orm";
import { subDays, startOfDay, endOfDay, format } from "date-fns";

// Get configuration from environment variables
function getConfig() {
  return {
    // Daily summary recipient (expert technician)
    expertTechnicianEmail: process.env.EXPERT_TECHNICIAN_EMAIL || "chavandhiksha212@gmail.com",
    // CEO escalation recipient
    ceoEmail: process.env.CEO_EMAIL || "chavandhiksha2003@gmail.com",
    // App URL for acknowledgment links
    appUrl: process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5000",
  };
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

export async function getDailyServiceRequestSummary(dateObj: Date = new Date(), useExactDate: boolean = false): Promise<DailySummary> {
  // If useExactDate is true, we use dateObj as is.
  // If false (default cron behavior), we use dateObj minus 1 day (Yesterday).

  const targetDate = useExactDate ? dateObj : subDays(dateObj, 1);
  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const requests = await db.query.serviceRequests.findMany({
    where: and(
      gte(serviceRequests.createdAt, start),
      lte(serviceRequests.createdAt, end)
    ),
  });

  const summary: DailySummary = {
    totalRequests: requests.length,
    assigned: 0,
    technicianAssigned: 0,
    inProgress: 0,
    technicianStarted: 0,
    completed: 0,
    delayed: 0,
    pending: 0,
    date: format(targetDate, "yyyy-MM-dd"),
  };

  for (const req of requests) {
    if (req.status === "pending") summary.pending++;
    if (req.status === "approved" || req.status === "scheduled" || req.status === "in_progress" || req.status === "completed") summary.assigned++; // Broad definition of assigned
    if (req.assignedTechnicianId) summary.technicianAssigned++;
    if (req.status === "in_progress") summary.inProgress++;
    if (req.actualStartTime) summary.technicianStarted++;
    if (req.status === "completed") summary.completed++;

    // Delayed: If scheduled date is passed and not completed, or if status is pending for too long?
    // Let's assume delayed if scheduledDate < now and status != completed
    if (req.scheduledDate && new Date(req.scheduledDate) < new Date() && req.status !== "completed") {
      summary.delayed++;
    }
  }

  return summary;
}

export function generateEmailHtml(summary: DailySummary, acknowledgmentLink: string, isEscalation: boolean = false) {
  const title = isEscalation
    ? `ESCALATION: Daily Service Summary Not Acknowledged – ${summary.date}`
    : `Daily Service Request Summary – ${summary.date}`;

  const color = isEscalation ? "#d32f2f" : "#1976d2";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: ${color};">${title}</h2>
      <p>Here is the summary for ${summary.date}:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Metric</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Count</th>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Total Requests</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.totalRequests}</td>
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
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.inProgress}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Technician Started</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.technicianStarted}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Completed</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.completed}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Delayed</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${summary.delayed > 0 ? 'red' : 'inherit'};">${summary.delayed}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Pending</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${summary.pending}</td>
        </tr>
      </table>

      ${!isEscalation ? `
        <div style="text-align: center; margin-top: 30px;">
          <a href="${acknowledgmentLink}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Acknowledge Summary</a>
          <p style="margin-top: 15px; font-size: 12px; color: #666;">
            Warning: If acknowledgment is not done by noon, CEO will be notified.
          </p>
        </div>
      ` : `
        <div style="margin-top: 20px; padding: 15px; background-color: #ffebee; border-left: 4px solid #d32f2f;">
          <p style="margin: 0; color: #d32f2f; font-weight: bold;">
            Acknowledgment from Sitaram was not received by 12:00 PM.
          </p>
        </div>
      `}
    </div>
  `;
}

export async function generateDailySummaryAndNotify() {
  const config = getConfig();
  
  try {
    const summary = await getDailyServiceRequestSummary();

    // Save to DB
    const [record] = await db.insert(dailySummaryAcknowledgment).values({
      date: summary.date,
      summary: summary,
      status: 'pending'
    }).returning();

    // Generate Link
    // We'll point to a frontend route or API route that handles the click.
    // Let's assume we have a frontend route /acknowledge-summary/:id
    // Or we can point directly to the API if it returns HTML.
    // User asked for "Link/button to 'Acknowledge Summary'".
    const acknowledgmentLink = `${config.appUrl}/api/summary/acknowledge-view/${record.id}`;

    // Send Email
    await sendEmail({
      to: config.expertTechnicianEmail,
      subject: `Daily Service Request Summary – ${summary.date}`,
      body: `Please review the daily summary for ${summary.date}. Total Requests: ${summary.totalRequests}.`,
      html: generateEmailHtml(summary, acknowledgmentLink, false)
    });

    console.log(`[DailySummary] ✅ Summary generated and sent to ${config.expertTechnicianEmail} for ${summary.date}`);
  } catch (error) {
    console.error("[DailySummary] ❌ Error generating daily summary:", error);
  }
}

export async function checkAndEscalate() {
  const config = getConfig();
  console.log(`[EscalationCheck] Starting escalation check at ${new Date().toLocaleString()}`);

  try {
    // We want to check the summary that was generated TODAY (at configured time).
    // That summary is for YESTERDAY's data.
    // So we are looking for a record where date = yesterday.

    const yesterday = subDays(new Date(), 1);
    const targetDate = format(yesterday, "yyyy-MM-dd");

    console.log(`[EscalationCheck] Target Summary Date: ${targetDate} (Yesterday)`);

    const [record] = await db.select().from(dailySummaryAcknowledgment)
      .where(eq(dailySummaryAcknowledgment.date, targetDate))
      .limit(1);

    if (!record) {
      console.log(`[EscalationCheck] ❌ No summary record found for date ${targetDate}. Summary generation might have failed.`);
      return;
    }

    console.log(`[EscalationCheck] Found record ID: ${record.id}, Status: ${record.status}`);

    if (record.status === 'pending') {
      console.log(`[EscalationCheck] Status is PENDING. Initiating escalation...`);

      const summary = record.summary as DailySummary;
      const acknowledgmentLink = `${config.appUrl}/api/summary/acknowledge-view/${record.id}`;

      try {
        console.log(`[EscalationCheck] Sending escalation email to CEO (${config.ceoEmail})...`);
        await sendEmail({
          to: config.ceoEmail,
          subject: `Escalation: Daily Service Summary Not Acknowledged – ${summary.date}`,
          body: `Daily summary for ${summary.date} was not acknowledged by the deadline.`,
          html: generateEmailHtml(summary, acknowledgmentLink, true)
        });
        console.log(`[EscalationCheck] ✅ Escalation email sent successfully.`);
      } catch (emailError: any) {
        console.error(`[EscalationCheck] ❌ FAILED TO SEND CEO EMAIL:`, emailError);
      }

    } else {
      console.log(`[EscalationCheck] Summary already acknowledged at ${record.acknowledgedAt}. No escalation needed.`);
    }
  } catch (error) {
    console.error("[EscalationCheck] ❌ Error in escalation check process:", error);
  }
}

export async function acknowledgeSummary(id: string) {
  const config = getConfig();
  
  const [record] = await db.select().from(dailySummaryAcknowledgment)
    .where(eq(dailySummaryAcknowledgment.id, id))
    .limit(1);

  if (!record) {
    throw new Error("Summary not found");
  }

  if (record.status === 'acknowledged') {
    return { message: "Already acknowledged", record };
  }

  const [updated] = await db.update(dailySummaryAcknowledgment)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date()
    })
    .where(eq(dailySummaryAcknowledgment.id, id))
    .returning();

  // Send acknowledgment confirmation to CEO
  try {
    const summary = updated.summary as DailySummary;
    const acknowledgedAt = updated.acknowledgedAt ? new Date(updated.acknowledgedAt).toLocaleString() : new Date().toLocaleString();

    await sendEmail({
      to: config.ceoEmail,
      subject: `✅ Daily Summary Acknowledged – ${summary.date}`,
      body: `Expert Technician has acknowledged today's service request summary at ${acknowledgedAt}.`,
      html: generateAcknowledgmentEmailHtml(summary, acknowledgedAt)
    });
    console.log("[DailySummary] CEO acknowledgment notification sent.");
  } catch (error) {
    console.error("[DailySummary] Failed to send CEO acknowledgment email:", error);
    // Don't fail the acknowledgment request itself
  }

  return { message: "Acknowledgment received", record: updated };
}

function generateAcknowledgmentEmailHtml(summary: DailySummary, acknowledgedAt: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2e7d32;">Daily Summary Acknowledged</h2>
      <p>Dear Sir,</p>
      <p>This is to inform you that the Daily Service Request Summary sent today has been acknowledged by Sitaram at <strong>${acknowledgedAt}</strong>.</p>
      
      <h3 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Summary Overview (${summary.date})</h3>
      <ul style="list-style-type: none; padding: 0;">
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Total:</strong> ${summary.totalRequests}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Assigned:</strong> ${summary.assigned}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Technician Assigned:</strong> ${summary.technicianAssigned}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>In Progress:</strong> ${summary.inProgress}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Technician Started:</strong> ${summary.technicianStarted}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Completed:</strong> ${summary.completed}</li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Delayed:</strong> <span style="color: ${summary.delayed > 0 ? 'red' : 'inherit'}">${summary.delayed}</span></li>
        <li style="padding: 5px 0; border-bottom: 1px solid #f5f5f5;"><strong>Pending:</strong> ${summary.pending}</li>
      </ul>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Regards,<br>
        Automated Reporting System<br>
        Service Hub
      </p>
    </div>
  `;
}

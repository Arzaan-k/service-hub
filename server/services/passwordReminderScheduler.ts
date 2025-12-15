import cron, { ScheduledTask } from 'node-cron';
import { db } from '../db';
import { users } from '@shared/schema';
import { and, eq, isNull, lt, isNotNull, sql } from 'drizzle-orm';
import { createPasswordResetToken, sendPasswordReminderEmail, sendPasswordEscalationEmail, logSecurityEvent } from './auth';

/**
 * Password Reminder Scheduler Service
 * - Sends reminder emails to technicians who haven't set their password within the configured delay
 * - Escalates to expert technician if password still not set after another delay period
 */

class PasswordReminderScheduler {
    private scheduledTask: ReturnType<typeof cron.schedule> | null = null;
    private isRunning = false;

    /**
     * Start the scheduler - runs every minute for testing (configurable)
     */
    public start(): void {
        if (this.isRunning) {
            console.log('⏭️  Password reminder scheduler already running');
            return;
        }

        // Use configurable interval: default every minute for testing
        const intervalMinutes = parseInt(process.env.PASSWORD_CHECK_INTERVAL_MINUTES || '1', 10);
        console.log(`🕒 Starting password reminder scheduler (runs every ${intervalMinutes} minute(s))...`);

        // Schedule task to run at the configured interval
        // For testing: '* * * * *' = every minute
        // For production: '0 * * * *' = every hour at minute 0
        const cronPattern = intervalMinutes === 1 ? '* * * * *' : `*/${intervalMinutes} * * * *`;
        
        this.scheduledTask = cron.schedule(cronPattern, async () => {
            await this.checkAndSendReminders();
            await this.checkAndEscalate();
        });

        this.isRunning = true;
        console.log('✅ Password reminder scheduler started successfully');

        // Run initial check immediately (after 30 seconds to let server fully start)
        setTimeout(() => {
            this.checkAndSendReminders();
            this.checkAndEscalate();
        }, 30000); // 30 second delay
    }

    /**
     * Stop the scheduler
     */
    public stop(): void {
        if (!this.isRunning || !this.scheduledTask) {
            console.log('⏭️  Password reminder scheduler not running');
            return;
        }

        console.log('🛑 Stopping password reminder scheduler...');
        this.scheduledTask.stop();
        this.scheduledTask = null;
        this.isRunning = false;
        console.log('✅ Password reminder scheduler stopped successfully');
    }

    /**
     * Check for technicians who need password reminders and send emails
     */
    private async checkAndSendReminders(): Promise<void> {
        try {
            console.log('🔍 [PASSWORD REMINDER] Checking for technicians who need password reminders...');
            const startTime = Date.now();

            // Get delay from environment variable (for testing) or default to 6 hours
            const reminderDelayHours = parseFloat(process.env.PASSWORD_REMINDER_DELAY_HOURS || '6');
            const reminderDelayMs = reminderDelayHours * 60 * 60 * 1000;
            const reminderThreshold = new Date(Date.now() - reminderDelayMs);

            console.log(`📅 [PASSWORD REMINDER] Looking for users created before ${reminderThreshold.toISOString()} (${reminderDelayHours} hours = ${(reminderDelayHours * 60).toFixed(1)} minutes ago)`);

            // Find technicians who:
            // 1. Were created before the threshold (delay period)
            // 2. Have role of 'technician' or 'senior_technician'
            // 3. Still have password === null (haven't set a password)
            // 4. Are still active (isActive === true)
            // 5. Have not been sent a reminder yet (passwordReminderSentAt is null)
            // 6. Have an email address
            const eligibleUsers = await db
                .select()
                .from(users)
                .where(
                    and(
                        lt(users.createdAt, reminderThreshold), // Created before threshold
                        sql`${users.role} IN ('technician', 'senior_technician')`, // Is a technician
                        isNull(users.password), // Password not set
                        eq(users.isActive, true), // User is active
                        isNull(users.passwordReminderSentAt), // Reminder not sent yet
                        sql`${users.email} IS NOT NULL AND ${users.email} != ''` // Has email
                    )
                );

            if (eligibleUsers.length === 0) {
                console.log('✅ [PASSWORD REMINDER] No technicians need password reminders at this time');
            } else {
                console.log(`📧 [PASSWORD REMINDER] Found ${eligibleUsers.length} technician(s) who need password reminders`);

                // Send reminders
                let successCount = 0;
                let failureCount = 0;

                for (const user of eligibleUsers) {
                    try {
                        console.log(`📤 [PASSWORD REMINDER] Sending reminder to ${user.email} (user: ${user.id}, created: ${user.createdAt})`);

                        // Generate a fresh password reset token
                        const { token, tokenRecord } = await createPasswordResetToken(
                            user.id,
                            undefined, // No admin triggered this
                            undefined, // No IP address
                            'password-reminder-scheduler' // User agent
                        );

                        // Send reminder email
                        const emailResult = await sendPasswordReminderEmail(user, token);

                        if (emailResult.success) {
                            // Mark reminder as sent
                            await db
                                .update(users)
                                .set({
                                    passwordReminderSentAt: new Date(),
                                    updatedAt: new Date()
                                })
                                .where(eq(users.id, user.id));

                            // Log security event
                            await logSecurityEvent(
                                user.id,
                                'password_reminder_sent',
                                null,
                                {
                                    email: user.email,
                                    role: user.role,
                                    createdAt: user.createdAt,
                                    reminderSentAt: new Date()
                                },
                                undefined
                            );

                            successCount++;
                            console.log(`✅ [PASSWORD REMINDER] Reminder sent successfully to ${user.email}`);
                        } else {
                            failureCount++;
                            console.error(`❌ [PASSWORD REMINDER] Failed to send reminder to ${user.email}: ${emailResult.error}`);
                        }
                    } catch (error: any) {
                        failureCount++;
                        console.error(`❌ [PASSWORD REMINDER] Error processing user ${user.id} (${user.email}):`, error.message);
                    }
                }

                const duration = Date.now() - startTime;
                console.log(`🎉 [PASSWORD REMINDER] Reminder check completed in ${duration}ms`);
                console.log(`📊 [PASSWORD REMINDER] Results: ${successCount} sent, ${failureCount} failed`);
            }

        } catch (error: any) {
            console.error('❌ [PASSWORD REMINDER] Error in scheduled reminder check:', error);
        }
    }

    /**
     * Check for technicians who need escalation to expert technician
     * This runs after the reminder delay period has passed since the reminder was sent
     */
    private async checkAndEscalate(): Promise<void> {
        try {
            console.log('🔍 [ESCALATION] Checking for technicians who need escalation to expert...');
            const startTime = Date.now();

            // Get expert technician email from environment
            const expertEmail = process.env.EXPERT_TECHNICIAN_EMAIL;
            if (!expertEmail) {
                console.log('⏭️  [ESCALATION] EXPERT_TECHNICIAN_EMAIL not configured, skipping escalation check');
                return;
            }

            // Escalation delay is counted from when the reminder was sent (default 2 hours)
            const escalationDelayHours = parseFloat(process.env.PASSWORD_ESCALATION_DELAY_HOURS || '2');
            const escalationDelayMs = escalationDelayHours * 60 * 60 * 1000;
            const escalationThreshold = new Date(Date.now() - escalationDelayMs);

            console.log(`📅 [ESCALATION] Looking for users whose reminder was sent before ${escalationThreshold.toISOString()} (${escalationDelayHours} hours = ${(escalationDelayHours * 60).toFixed(1)} minutes ago)`);

            // Find technicians who:
            // 1. Have received a reminder (passwordReminderSentAt is NOT null)
            // 2. Reminder was sent before the escalation threshold
            // 3. Still have password === null (haven't set a password)
            // 4. Have not received escalation email yet (passwordEscalationSentAt is null)
            // 5. Are still active
            // 6. Have role of 'technician' or 'senior_technician'
            const eligibleForEscalation = await db
                .select()
                .from(users)
                .where(
                    and(
                        isNotNull(users.passwordReminderSentAt), // Reminder was sent
                        lt(users.passwordReminderSentAt, escalationThreshold), // Reminder sent before threshold
                        isNull(users.password), // Password still not set
                        isNull(users.passwordEscalationSentAt), // Escalation not sent yet
                        eq(users.isActive, true), // User is active
                        sql`${users.role} IN ('technician', 'senior_technician')` // Is a technician
                    )
                );

            if (eligibleForEscalation.length === 0) {
                console.log('✅ [ESCALATION] No technicians need escalation at this time');
            } else {
                console.log(`🚨 [ESCALATION] Found ${eligibleForEscalation.length} technician(s) who need escalation`);

                let successCount = 0;
                let failureCount = 0;

                for (const user of eligibleForEscalation) {
                    try {
                        console.log(`📤 [ESCALATION] Sending escalation to ${expertEmail} about ${user.email}`);

                        // Send escalation email to expert technician
                        const emailResult = await sendPasswordEscalationEmail(expertEmail, user);

                        if (emailResult.success) {
                            // Mark escalation as sent
                            await db
                                .update(users)
                                .set({
                                    passwordEscalationSentAt: new Date(),
                                    updatedAt: new Date()
                                })
                                .where(eq(users.id, user.id));

                            // Log security event
                            await logSecurityEvent(
                                user.id,
                                'password_escalation_sent',
                                null,
                                {
                                    userEmail: user.email,
                                    expertEmail: expertEmail,
                                    role: user.role,
                                    createdAt: user.createdAt,
                                    reminderSentAt: user.passwordReminderSentAt,
                                    escalationSentAt: new Date()
                                },
                                undefined
                            );

                            successCount++;
                            console.log(`✅ [ESCALATION] Escalation sent successfully to ${expertEmail} about ${user.email}`);
                        } else {
                            failureCount++;
                            console.error(`❌ [ESCALATION] Failed to send escalation for ${user.email}: ${emailResult.error}`);
                        }
                    } catch (error: any) {
                        failureCount++;
                        console.error(`❌ [ESCALATION] Error processing escalation for ${user.id} (${user.email}):`, error.message);
                    }
                }

                const duration = Date.now() - startTime;
                console.log(`🎉 [ESCALATION] Escalation check completed in ${duration}ms`);
                console.log(`📊 [ESCALATION] Results: ${successCount} sent, ${failureCount} failed`);
            }

        } catch (error: any) {
            console.error('❌ [ESCALATION] Error in escalation check:', error);
        }
    }

    /**
     * Get scheduler status
     */
    public getStatus() {
        const intervalMinutes = parseInt(process.env.PASSWORD_CHECK_INTERVAL_MINUTES || '1', 10);
        return {
            isRunning: this.isRunning,
            nextExecution: this.scheduledTask ? `Every ${intervalMinutes} minute(s)` : 'Not scheduled',
            reminderDelay: process.env.PASSWORD_REMINDER_DELAY_HOURS ? `${process.env.PASSWORD_REMINDER_DELAY_HOURS}h` : '6h (default)',
            escalationDelay: process.env.PASSWORD_ESCALATION_DELAY_HOURS ? `${process.env.PASSWORD_ESCALATION_DELAY_HOURS}h` : '2h (default)',
            expertEmail: process.env.EXPERT_TECHNICIAN_EMAIL || 'Not configured',
        };
    }

    /**
     * Manually trigger a reminder and escalation check (for testing or manual execution)
     */
    public async triggerCheck(): Promise<void> {
        console.log('🔄 [PASSWORD REMINDER] Manually triggering reminder and escalation check...');
        await this.checkAndSendReminders();
        await this.checkAndEscalate();
    }
}

// Singleton instance
let schedulerInstance: PasswordReminderScheduler | null = null;

/**
 * Get or create the password reminder scheduler
 */
export function getPasswordReminderScheduler(): PasswordReminderScheduler {
    if (!schedulerInstance) {
        schedulerInstance = new PasswordReminderScheduler();
    }
    return schedulerInstance;
}

/**
 * Start password reminder scheduler
 */
export function startPasswordReminderScheduler(): void {
    const scheduler = getPasswordReminderScheduler();
    scheduler.start();
}

/**
 * Stop password reminder scheduler
 */
export function stopPasswordReminderScheduler(): void {
    const scheduler = getPasswordReminderScheduler();
    scheduler.stop();
}

export { PasswordReminderScheduler };

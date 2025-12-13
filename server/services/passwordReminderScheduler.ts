import cron from 'node-cron';
import { db } from '../db';
import { users } from '@shared/schema';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { createPasswordResetToken, sendPasswordReminderEmail, logSecurityEvent } from './auth';

/**
 * Password Reminder Scheduler Service
 * Sends reminder emails to technicians who haven't set their password within 24 hours
 */

class PasswordReminderScheduler {
    private scheduledTask: cron.ScheduledTask | null = null;
    private isRunning = false;

    /**
     * Start the scheduler - runs every hour
     */
    public start(): void {
        if (this.isRunning) {
            console.log('⏭️  Password reminder scheduler already running');
            return;
        }

        console.log('🕒 Starting password reminder scheduler (runs every hour)...');

        // Schedule task to run every hour
        // Cron pattern: '0 * * * *' = at minute 0 of every hour
        this.scheduledTask = cron.schedule('0 * * * *', async () => {
            await this.checkAndSendReminders();
        });

        this.isRunning = true;
        console.log('✅ Password reminder scheduler started successfully');

        // Run initial check immediately (after 1 minute to let server fully start)
        setTimeout(() => {
            this.checkAndSendReminders();
        }, 60000); // 1 minute delay
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

            // Get delay from environment variable (for testing) or default to 24 hours
            const delayHours = parseFloat(process.env.PASSWORD_REMINDER_DELAY_HOURS || '24');
            const delayMs = delayHours * 60 * 60 * 1000;
            const reminderThreshold = new Date(Date.now() - delayMs);

            console.log(`📅 [PASSWORD REMINDER] Looking for users created before ${reminderThreshold.toISOString()} (${delayHours} hours ago)`);

            // Find technicians who:
            // 1. Were created 24+ hours ago (or test delay)
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
                return;
            }

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

        } catch (error: any) {
            console.error('❌ [PASSWORD REMINDER] Error in scheduled reminder check:', error);
        }
    }

    /**
     * Get scheduler status
     */
    public getStatus() {
        return {
            isRunning: this.isRunning,
            nextExecution: this.scheduledTask ? 'Every hour (at minute 0)' : 'Not scheduled',
            testMode: process.env.PASSWORD_REMINDER_DELAY_HOURS ? `Enabled (${process.env.PASSWORD_REMINDER_DELAY_HOURS}h delay)` : 'Disabled (24h delay)',
        };
    }

    /**
     * Manually trigger a reminder check (for testing or manual execution)
     */
    public async triggerCheck(): Promise<void> {
        console.log('🔄 [PASSWORD REMINDER] Manually triggering reminder check...');
        await this.checkAndSendReminders();
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

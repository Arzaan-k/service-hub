
import 'dotenv/config';
import { db } from "./db";
import {
    users,
    technicians,
    technicianDocuments,
    locationLogs,
    scheduledServices,
    feedback,
    technicianTrips,
    technicianTripTasks,
    technicianTripCosts,
    serviceRequests,
    auditLogs,
    whatsappSessions,
    emailVerifications,
    inventoryTransactions,
    alerts,
    courierShipments,
    inventoryIndents,
    ragQueries,
    manuals,
    passwordResetTokens
} from "@shared/schema";
import { eq, inArray, or } from "drizzle-orm";

async function deleteTechnicianByEmail(email: string) {
    console.log(`[DELETE TECH] Starting deletion for email: ${email}`);

    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });

    if (!user) {
        console.log(`[DELETE TECH] User with email ${email} not found`);
        return;
    }

    console.log(`[DELETE TECH] Found user ${user.id} (${user.name})`);

    const technician = await db.query.technicians.findFirst({
        where: eq(technicians.userId, user.id)
    });

    // Check for dependencies that might prevent user deletion
    // 1. Service Requests created by user
    const createdRequests = await db.query.serviceRequests.findMany({
        where: eq(serviceRequests.createdBy, user.id),
        limit: 1
    });
    if (createdRequests.length > 0) {
        console.warn(`[WARNING] User has created Service Requests. Cannot delete user account comfortably without reassigning ownership. Deleting only technician profile.`);
        await deleteTechnicianProfileOnly(user.id, technician);
        // Disable user
        await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
        console.log(`[DELETE TECH] User account deactivated instead of deleted.`);
        return;
    }

    // 2. Courier Shipments added by user
    const shipments = await db.query.courierShipments.findMany({
        where: eq(courierShipments.addedBy, user.id),
        limit: 1
    });
    if (shipments.length > 0) {
        console.warn(`[WARNING] User has added Courier Shipments. Cannot delete user account. Deleting only technician profile.`);
        await deleteTechnicianProfileOnly(user.id, technician);
        await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
        return;
    }

    // If no blocking dependencies, proceed with full deletion
    await db.transaction(async (tx) => {
        if (technician) {
            console.log(`[DELETE TECH] Found technician profile ${technician.id}, cleaning up technician data...`);
            // 1. Delete technician documents
            await tx.delete(technicianDocuments).where(eq(technicianDocuments.technicianId, technician.id));

            // 2. Delete location logs
            await tx.delete(locationLogs).where(eq(locationLogs.employeeId, technician.id));

            // 3. Delete scheduled services
            await tx.delete(scheduledServices).where(eq(scheduledServices.technicianId, technician.id));

            // 4. Delete feedback
            await tx.delete(feedback).where(eq(feedback.technicianId, technician.id));

            // 5. Handle trips
            const trips = await tx.query.technicianTrips.findMany({
                where: eq(technicianTrips.technicianId, technician.id),
                columns: { id: true }
            });

            if (trips.length > 0) {
                const tripIds = trips.map(t => t.id);
                await tx.delete(technicianTripTasks).where(inArray(technicianTripTasks.tripId, tripIds));
                await tx.delete(technicianTripCosts).where(inArray(technicianTripCosts.tripId, tripIds));
                await tx.delete(technicianTrips).where(eq(technicianTrips.technicianId, technician.id));
            }

            // 6. Unassign service requests
            await tx.update(serviceRequests)
                .set({ assignedTechnicianId: null })
                .where(eq(serviceRequests.assignedTechnicianId, technician.id));

            // 7. Delete technician record
            await tx.delete(technicians).where(eq(technicians.id, technician.id));
        }

        // Clean up User associations
        console.log(`[DELETE TECH] Cleaning up user associations...`);

        // Audit logs
        await tx.delete(auditLogs).where(eq(auditLogs.userId, user.id));

        // WhatsApp Sessions
        await tx.delete(whatsappSessions).where(eq(whatsappSessions.userId, user.id));

        // Email Verifications
        await tx.delete(emailVerifications).where(eq(emailVerifications.userId, user.id));

        // Password Reset Tokens
        await tx.delete(passwordResetTokens).where(or(eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.createdBy, user.id)));

        // Inventory Transactions
        await tx.delete(inventoryTransactions).where(eq(inventoryTransactions.userId, user.id));

        // Manuals (uploaded by) - Set to null or delete? Manuals users might be important. Set to null if nullable?
        // uploadedBy is nullable? Let's check schema.
        // uploadedBy: varchar("uploaded_by").references(() => users.id), // Nullable
        await tx.update(manuals).set({ uploadedBy: null }).where(eq(manuals.uploadedBy, user.id));

        // RAG Queries
        await tx.delete(ragQueries).where(eq(ragQueries.userId, user.id));

        // Alerts (acknowledgedBy)
        await tx.update(alerts).set({ acknowledgedBy: null }).where(eq(alerts.acknowledgedBy, user.id));

        // Finally delete user
        await tx.delete(users).where(eq(users.id, user.id));
        console.log(`[DELETE TECH] Deleted user record`);
    });

    console.log(`[DELETE TECH] Successfully completed deletion for ${email}`);
}

async function deleteTechnicianProfileOnly(userId: string, technician: any) {
    if (!technician) return;

    await db.transaction(async (tx) => {
        // Same technician cleanup as above
        await tx.delete(technicianDocuments).where(eq(technicianDocuments.technicianId, technician.id));
        await tx.delete(locationLogs).where(eq(locationLogs.employeeId, technician.id));
        await tx.delete(scheduledServices).where(eq(scheduledServices.technicianId, technician.id));
        await tx.delete(feedback).where(eq(feedback.technicianId, technician.id));

        const trips = await tx.query.technicianTrips.findMany({
            where: eq(technicianTrips.technicianId, technician.id),
            columns: { id: true }
        });

        if (trips.length > 0) {
            const tripIds = trips.map(t => t.id);
            await tx.delete(technicianTripTasks).where(inArray(technicianTripTasks.tripId, tripIds));
            await tx.delete(technicianTripCosts).where(inArray(technicianTripCosts.tripId, tripIds));
            await tx.delete(technicianTrips).where(eq(technicianTrips.technicianId, technician.id));
        }

        await tx.update(serviceRequests)
            .set({ assignedTechnicianId: null })
            .where(eq(serviceRequests.assignedTechnicianId, technician.id));

        await tx.delete(technicians).where(eq(technicians.id, technician.id));
    });
    console.log(`[DELETE TECH] Deleted technician profile only.`);
}

const email = "auditor@crystalgroup.in";
deleteTechnicianByEmail(email)
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error deleting technician:", err);
        process.exit(1);
    });

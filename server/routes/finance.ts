
import { type Express, Request, Response } from "express";
import { db } from "../db";
import {
    financeExpenses,
    containers,
    serviceRequests,
    technicianTripTasks,
    technicianTripCosts,
    technicianTrips,
    technicians,
    customers,
    insertFinanceExpenseSchema
} from "@shared/schema";
import { eq, and, desc, sql, sum } from "drizzle-orm";

export function registerFinanceRoutes(app: Express) {

    // GET /api/finance/overview
    app.get("/api/finance/overview", async (req: Request, res: Response) => {
        try {
            // 1. Fetch All Service Requests
            const requests = await db.query.serviceRequests.findMany({
                with: {
                    technician: true
                }
            });

            // 2. Fetch All Trips
            const trips = await db.query.technicianTrips.findMany({
                with: {
                    costs: true,
                    technician: true
                }
            });

            // 3. Fetch All Expenses
            const expenses = await db.query.financeExpenses.findMany({
                with: {
                    technician: true
                }
            });

            let totalSpend = 0;
            let pmSpend = 0;
            let correctiveSpend = 0;
            let travelSpend = 0;
            let miscSpend = 0;

            const monthlySpendMap = new Map<string, number>();
            const technicianSpendMap = new Map<string, number>();
            const containerSpendMap = new Map<string, number>(); // Need to fetch container info for requests

            // Process Requests
            for (const req of requests) {
                const cost = Number(req.totalCost || 0);
                totalSpend += cost;

                const isPm = req.issueDescription?.toLowerCase().includes("pm") ||
                    req.workType?.toLowerCase().includes("pm") ||
                    req.jobType?.toLowerCase().includes("pm");

                if (isPm) pmSpend += cost;
                else correctiveSpend += cost;

                const date = req.actualEndTime || req.scheduledDate || req.createdAt;
                const monthKey = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                if (req.technicianId) {
                    const techName = req.technician?.name || "Unknown";
                    technicianSpendMap.set(techName, (technicianSpendMap.get(techName) || 0) + cost);
                }

                if (req.containerId) {
                    containerSpendMap.set(req.containerId, (containerSpendMap.get(req.containerId) || 0) + cost);
                }
            }

            // Process Trips
            for (const trip of trips) {
                const cost = Number(trip.costs?.totalEstimatedCost || 0);
                if (cost > 0) {
                    travelSpend += cost;
                    totalSpend += cost;

                    const date = trip.startDate;
                    const monthKey = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                    monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                    if (trip.technicianId) {
                        const techName = trip.technician?.name || "Unknown";
                        technicianSpendMap.set(techName, (technicianSpendMap.get(techName) || 0) + cost);
                    }
                }
            }

            // Process Expenses
            for (const exp of expenses) {
                const cost = Number(exp.amount);
                totalSpend += cost;

                if (exp.expenseType === 'Travel') {
                    travelSpend += cost;
                } else {
                    miscSpend += cost;
                }

                const date = exp.date;
                const monthKey = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                if (exp.technicianId) {
                    const techName = exp.technician?.name || "Unknown";
                    technicianSpendMap.set(techName, (technicianSpendMap.get(techName) || 0) + cost);
                }

                if (exp.containerId) {
                    containerSpendMap.set(exp.containerId, (containerSpendMap.get(exp.containerId) || 0) + cost);
                }
            }

            // Format Data
            const monthly_spend = Array.from(monthlySpendMap.entries()).map(([month, amount]) => ({
                month,
                amount
            }));

            const top_technicians = Array.from(technicianSpendMap.entries())
                .map(([name, amount]) => ({ name, amount }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);

            // We need to resolve container IDs to Codes for the top list
            // This is a bit inefficient to fetch all, but for now let's just fetch the top ones
            const topContainerIds = Array.from(containerSpendMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            const top_containers = [];
            for (const [id, amount] of topContainerIds) {
                const c = await db.query.containers.findFirst({
                    where: eq(containers.id, id),
                    columns: { containerCode: true }
                });
                top_containers.push({
                    code: c?.containerCode || id,
                    amount
                });
            }

            const currentMonthKey = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
            const spendThisMonth = monthlySpendMap.get(currentMonthKey) || 0;

            res.json({
                total_spend: totalSpend,
                spend_this_month: spendThisMonth,
                pm_spend: pmSpend,
                corrective_spend: correctiveSpend,
                travel_spend: travelSpend,
                misc_spend: miscSpend,
                monthly_spend,
                top_technicians,
                top_containers
            });

        } catch (error) {
            console.error("Error fetching finance overview:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });

    // GET /api/finance/container-spend/:containerId
    app.get("/api/finance/container-spend/:containerId", async (req: Request, res: Response) => {
        try {
            const { containerId } = req.params;

            // 1. Fetch Container Details
            const container = await db.query.containers.findFirst({
                where: eq(containers.id, containerId),
                with: {
                    customer: true
                }
            });

            if (!container) {
                return res.status(404).json({ message: "Container not found" });
            }

            // 2. Fetch Service Requests (PM & Corrective)
            const requests = await db.query.serviceRequests.findMany({
                where: eq(serviceRequests.containerId, containerId),
                with: {
                    technician: true
                },
                orderBy: [desc(serviceRequests.scheduledDate)]
            });

            // 3. Fetch Technician Trips (Travel Costs)
            // Find trips that have tasks for this container
            const tripTasks = await db.query.technicianTripTasks.findMany({
                where: eq(technicianTripTasks.containerId, containerId),
                with: {
                    trip: {
                        with: {
                            costs: true,
                            technician: true
                        }
                    }
                }
            });

            // 4. Fetch Miscellaneous Expenses
            const expenses = await db.query.financeExpenses.findMany({
                where: eq(financeExpenses.containerId, containerId),
                with: {
                    technician: true
                },
                orderBy: [desc(financeExpenses.date)]
            });

            // --- Aggregation Logic ---

            let totalSpend = 0;
            let pmSpend = 0;
            let correctiveSpend = 0;
            let travelSpend = 0;
            let miscSpend = 0;

            const monthlySpendMap = new Map<string, number>();

            const transactions: any[] = [];

            // Process Service Requests
            for (const req of requests) {
                const cost = Number(req.totalCost || 0);
                totalSpend += cost;

                // Determine type
                // Simple heuristic: if description contains "PM" or workType is "PM", it's PM. Else Corrective.
                const isPm = req.issueDescription?.toLowerCase().includes("pm") ||
                    req.workType?.toLowerCase().includes("pm") ||
                    req.jobType?.toLowerCase().includes("pm");

                if (isPm) {
                    pmSpend += cost;
                } else {
                    correctiveSpend += cost;
                }

                const date = req.actualEndTime || req.scheduledDate || req.createdAt;
                const monthKey = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                transactions.push({
                    id: req.id,
                    date: date,
                    service_type: isPm ? "PM" : "Corrective",
                    technician: req.technician?.name || "Unassigned",
                    description: req.issueDescription,
                    amount: cost,
                    source: "Service Request"
                });
            }

            // Process Trips (Travel)
            // Note: A trip might have multiple tasks. We should ideally split the cost.
            // For now, we'll take the full trip cost if it's associated, but maybe mark it.
            // Or better, if we have multiple tasks, we divide by number of tasks?
            // Let's just add it as "Travel" for now, maybe flagging if it's shared.
            // To avoid double counting if multiple tasks point to same trip, we track processed trip IDs.
            const processedTripIds = new Set<string>();

            for (const task of tripTasks) {
                if (!task.trip) continue;
                if (processedTripIds.has(task.trip.id)) continue;
                processedTripIds.add(task.trip.id);

                const costs = task.trip.costs;
                const totalTripCost = Number(costs?.totalEstimatedCost || 0);

                // We could try to be smarter about splitting, but for now, let's just use the total.
                // Or maybe we shouldn't include it if it's 0.
                if (totalTripCost > 0) {
                    travelSpend += totalTripCost;
                    totalSpend += totalTripCost;

                    const date = task.trip.startDate;
                    const monthKey = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                    monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + totalTripCost);

                    transactions.push({
                        id: task.trip.id,
                        date: date,
                        service_type: "Travel",
                        technician: task.trip.technician?.name || "Unknown",
                        description: `Trip to ${task.trip.destinationCity} (${task.trip.purpose})`,
                        amount: totalTripCost,
                        source: "Trip"
                    });
                }
            }

            // Process Misc Expenses
            for (const exp of expenses) {
                const cost = Number(exp.amount);
                totalSpend += cost;
                miscSpend += cost; // Or split based on expenseType if needed. The user said "Travel + Misc Costs".

                if (exp.expenseType === 'Travel') {
                    // If explicitly marked as travel in misc expenses
                    travelSpend += cost;
                    // Wait, I shouldn't double count. miscSpend is a category in the summary.
                    // The user asked for "Travel + Misc Costs" as one metric or separate?
                    // "Travel + Misc Costs" is one bullet point.
                    // But in JSON response: "travel_spend": 0, "misc_spend": 0.
                    // I'll keep them separate in JSON.
                    // If expenseType is Travel, add to travelSpend, else miscSpend.
                    // Actually, let's adjust:
                    miscSpend -= cost; // remove from misc
                } else {
                    // it stays in miscSpend
                }

                const date = exp.date; // string or date object
                const monthKey = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                transactions.push({
                    id: exp.id,
                    date: date,
                    service_type: exp.expenseType, // Travel, Material, Misc
                    technician: exp.technician?.name || "N/A",
                    description: exp.description,
                    amount: cost,
                    source: "Expense"
                });
            }

            // Format Monthly Spend
            const monthly_spend = Array.from(monthlySpendMap.entries()).map(([month, amount]) => ({
                month,
                amount
            }));

            // Sort transactions by date desc
            transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Calculate "Spend This Month"
            const currentMonthKey = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
            const spendThisMonth = monthlySpendMap.get(currentMonthKey) || 0;

            res.json({
                container_id: container.containerCode,
                client: container.customer?.companyName || "Unknown",
                total_spend: totalSpend,
                spend_this_month: spendThisMonth,
                monthly_spend,
                pm_spend: pmSpend,
                corrective_spend: correctiveSpend,
                travel_spend: travelSpend,
                misc_spend: miscSpend,
                transactions
            });

        } catch (error) {
            console.error("Error fetching container spend:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });

    // GET /api/finance/reefer-spend
    app.get("/api/finance/reefer-spend", async (req: Request, res: Response) => {
        try {
            // 1. Fetch all spend data first to identify relevant containers
            const requests = await db.query.serviceRequests.findMany({
                columns: { containerId: true, totalCost: true }
            });

            const tripTasks = await db.query.technicianTripTasks.findMany({
                with: {
                    trip: {
                        with: { costs: true }
                    }
                }
            });

            const expenses = await db.query.financeExpenses.findMany({
                columns: { containerId: true, amount: true }
            });

            // 2. Aggregate spend by container
            const containerSpendMap = new Map<string, number>();

            for (const req of requests) {
                if (req.containerId) {
                    const cost = Number(req.totalCost || 0);
                    if (cost > 0) {
                        containerSpendMap.set(req.containerId, (containerSpendMap.get(req.containerId) || 0) + cost);
                    }
                }
            }

            const processedTripIds = new Set<string>();
            for (const task of tripTasks) {
                if (task.containerId && task.trip) {
                    if (processedTripIds.has(task.trip.id)) continue;
                    processedTripIds.add(task.trip.id);

                    const cost = Number(task.trip.costs?.totalEstimatedCost || 0);
                    if (cost > 0) {
                        containerSpendMap.set(task.containerId, (containerSpendMap.get(task.containerId) || 0) + cost);
                    }
                }
            }

            for (const exp of expenses) {
                if (exp.containerId) {
                    const cost = Number(exp.amount || 0);
                    if (cost > 0) {
                        containerSpendMap.set(exp.containerId, (containerSpendMap.get(exp.containerId) || 0) + cost);
                    }
                }
            }

            // 3. Fetch details for these containers, filtering for Reefers
            const containerIds = Array.from(containerSpendMap.keys());

            if (containerIds.length === 0) {
                return res.json([]);
            }

            // Fetch in chunks if too many, but for now assuming it fits
            const relevantContainers = await db.query.containers.findMany({
                where: sql`${containers.id} IN ${containerIds} AND (${containers.type} = 'refrigerated' OR ${containers.productType} ILIKE '%Reefer%')`,
                with: {
                    customer: true
                }
            });

            // 4. Construct response
            const results = relevantContainers.map(c => ({
                id: c.id,
                containerCode: c.containerCode,
                client: c.customer?.companyName || "Unknown",
                totalSpend: containerSpendMap.get(c.id) || 0,
                type: c.type || c.productType || "Reefer"
            }));

            // Sort by spend desc
            results.sort((a, b) => b.totalSpend - a.totalSpend);

            res.json(results);

        } catch (error) {
            console.error("Error fetching reefer spend:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });

    // GET /api/finance/technician-spend
    app.get("/api/finance/technician-spend", async (req: Request, res: Response) => {
        try {
            // 1. Fetch all spend data
            const requests = await db.query.serviceRequests.findMany({
                columns: { assignedTechnicianId: true, totalCost: true }
            });

            const trips = await db.query.technicianTrips.findMany({
                columns: { technicianId: true, costs: true }
            });

            const expenses = await db.query.financeExpenses.findMany({
                columns: { technicianId: true, amount: true }
            });

            // 2. Aggregate spend by technician
            const technicianSpendMap = new Map<string, number>();

            for (const req of requests) {
                if (req.assignedTechnicianId) {
                    const cost = Number(req.totalCost || 0);
                    if (cost > 0) {
                        technicianSpendMap.set(req.assignedTechnicianId, (technicianSpendMap.get(req.assignedTechnicianId) || 0) + cost);
                    }
                }
            }

            for (const trip of trips) {
                if (trip.technicianId) {
                    const cost = Number(trip.costs?.totalEstimatedCost || 0);
                    if (cost > 0) {
                        technicianSpendMap.set(trip.technicianId, (technicianSpendMap.get(trip.technicianId) || 0) + cost);
                    }
                }
            }

            for (const exp of expenses) {
                if (exp.technicianId) {
                    const cost = Number(exp.amount || 0);
                    if (cost > 0) {
                        technicianSpendMap.set(exp.technicianId, (technicianSpendMap.get(exp.technicianId) || 0) + cost);
                    }
                }
            }

            // 3. Fetch technician details
            const technicianIds = Array.from(technicianSpendMap.keys());

            if (technicianIds.length === 0) {
                return res.json([]);
            }

            const relevantTechnicians = await db.query.technicians.findMany({
                where: sql`${technicians.id} IN ${technicianIds}`,
            });

            // 4. Construct response
            const results = relevantTechnicians.map(t => ({
                id: t.id,
                name: t.name,
                totalSpend: technicianSpendMap.get(t.id) || 0,
            }));

            // Sort by spend desc
            results.sort((a, b) => b.totalSpend - a.totalSpend);

            res.json(results);

        } catch (error) {
            console.error("Error fetching technician spend:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });

    // GET /api/finance/technician-spend/:technicianId
    app.get("/api/finance/technician-spend/:technicianId", async (req: Request, res: Response) => {
        try {
            const { technicianId } = req.params;

            // Fetch Technician Details
            const technician = await db.query.technicians.findFirst({
                where: eq(technicians.id, technicianId),
            });

            if (!technician) {
                return res.status(404).json({ message: "Technician not found" });
            }

            // Fetch Service Requests (Labor/Parts)
            const requests = await db.query.serviceRequests.findMany({
                where: eq(serviceRequests.assignedTechnicianId, technicianId),
                with: {
                    container: true,
                }
            });

            // Fetch Trips (Travel)
            const trips = await db.query.technicianTrips.findMany({
                where: eq(technicianTrips.technicianId, technicianId),
            });

            // Fetch Misc Expenses
            const expenses = await db.query.financeExpenses.findMany({
                where: eq(financeExpenses.technicianId, technicianId),
                with: {
                    container: true,
                }
            });

            let totalSpend = 0;
            let spendThisMonth = 0;
            let travelSpend = 0;
            let laborSpend = 0;
            let miscSpend = 0;

            const monthlySpendMap = new Map<string, number>();
            const transactions: any[] = [];

            const now = new Date();
            const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // Process Service Requests
            for (const req of requests) {
                const cost = Number(req.totalCost || 0);
                if (cost > 0) {
                    totalSpend += cost;
                    laborSpend += cost; // Assuming SR cost is mostly labor/parts, treating as 'Labor' for now or 'Service'

                    const date = req.actualEndTime || req.scheduledDate || req.requestedAt;
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                    if (monthKey === currentMonthKey) {
                        spendThisMonth += cost;
                    }

                    transactions.push({
                        id: req.id,
                        date: date,
                        type: "Service Request",
                        description: `SR #${req.requestNumber} - ${req.issueDescription}`,
                        amount: cost,
                        reference: req.container?.containerCode || "N/A"
                    });
                }
            }

            // Process Trips
            for (const trip of trips) {
                const cost = Number(trip.costs?.totalEstimatedCost || 0);
                if (cost > 0) {
                    totalSpend += cost;
                    travelSpend += cost;

                    const date = new Date(trip.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                    if (monthKey === currentMonthKey) {
                        spendThisMonth += cost;
                    }

                    transactions.push({
                        id: trip.id,
                        date: date,
                        type: "Trip",
                        description: `Trip to ${trip.startLocation} -> ${trip.endLocation}`,
                        amount: cost,
                        reference: "Travel"
                    });
                }
            }

            // Process Expenses
            for (const exp of expenses) {
                const cost = Number(exp.amount || 0);
                if (cost > 0) {
                    totalSpend += cost;
                    miscSpend += cost;

                    const date = new Date(exp.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlySpendMap.set(monthKey, (monthlySpendMap.get(monthKey) || 0) + cost);

                    if (monthKey === currentMonthKey) {
                        spendThisMonth += cost;
                    }

                    transactions.push({
                        id: exp.id,
                        date: date,
                        type: exp.expenseType,
                        description: exp.description || "Misc Expense",
                        amount: cost,
                        reference: exp.container?.containerCode || "N/A"
                    });
                }
            }

            // Sort transactions by date desc
            transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Format monthly spend
            const monthlySpend = Array.from(monthlySpendMap.entries())
                .map(([month, amount]) => ({ month, amount }))
                .sort((a, b) => a.month.localeCompare(b.month));

            res.json({
                technician,
                total_spend: totalSpend,
                spend_this_month: spendThisMonth,
                travel_spend: travelSpend,
                labor_spend: laborSpend,
                misc_spend: miscSpend,
                monthly_spend: monthlySpend,
                transactions
            });

        } catch (error) {
            console.error("Error fetching technician spend details:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });

    // POST /api/finance/container-spend/add
    app.post("/api/finance/container-spend/add", async (req: Request, res: Response) => {
        try {
            const data = insertFinanceExpenseSchema.parse(req.body);

            const result = await db.insert(financeExpenses).values(data).returning();

            res.json(result[0]);
        } catch (error) {
            console.error("Error adding expense:", error);
            res.status(400).json({ message: "Invalid data" });
        }
    });
}

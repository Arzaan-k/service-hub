import { db } from "./db";
import { 
  users, 
  customers, 
  technicians, 
  containers, 
  alerts, 
  serviceRequests, 
  invoices, 
  feedback,
  inventory
} from "../shared/schema";

export async function seedDatabase() {
  console.log("🌱 Seeding database with sample data...");

  try {
    // Create sample users
    const adminUser = await db.insert(users).values({
      phoneNumber: "+1234567890",
      name: "Admin User",
      email: "admin@containergenie.com",
      role: "admin",
      isActive: true,
      whatsappVerified: true,
    }).returning();

    const clientUser = await db.insert(users).values({
      phoneNumber: "+1987654321",
      name: "John Smith",
      email: "john@logistics.com",
      role: "client",
      isActive: true,
      whatsappVerified: true,
    }).returning();

    const technicianUser = await db.insert(users).values({
      phoneNumber: "+1555123456",
      name: "Mike Johnson",
      email: "mike@containergenie.com",
      role: "technician",
      isActive: true,
      whatsappVerified: true,
    }).returning();

    // Create sample customers
    const customer1 = await db.insert(customers).values({
      userId: clientUser[0].id,
      companyName: "Global Logistics Inc",
      contactPerson: "John Smith",
      email: "john@logistics.com",
      phone: "+1987654321",
      whatsappNumber: "+1987654321",
      customerTier: "premium",
      paymentTerms: "net30",
      billingAddress: "123 Business St, New York, NY 10001",
      shippingAddress: "456 Warehouse Ave, New York, NY 10002",
      gstin: "12ABCDE1234F1Z5",
      accountManagerId: adminUser[0].id,
      status: "active",
    }).returning();

    const customer2 = await db.insert(customers).values({
      userId: clientUser[0].id,
      companyName: "Fast Freight Co",
      contactPerson: "Sarah Wilson",
      email: "sarah@fastfreight.com",
      phone: "+1555987654",
      whatsappNumber: "+1555987654",
      customerTier: "standard",
      paymentTerms: "net15",
      billingAddress: "789 Commerce Blvd, Los Angeles, CA 90210",
      shippingAddress: "321 Port St, Los Angeles, CA 90211",
      gstin: "98ZYXWV9876A1B2",
      accountManagerId: adminUser[0].id,
      status: "active",
    }).returning();

    // Create sample technicians
    const technician1 = await db.insert(technicians).values({
      userId: technicianUser[0].id,
      employeeCode: "TECH001",
      name: "Mike Johnson",
      phone: "+1555123456",
      whatsappNumber: "+1555123456",
      email: "mike@containergenie.com",
      baseLocation: { lat: 34.0522, lng: -118.2437 }, // Los Angeles
      serviceRadius: 50,
      skills: ["refrigeration", "electrical", "mechanical"],
      experienceLevel: "senior",
      hourlyRate: "75.00",
      workingHoursStart: "08:00",
      workingHoursEnd: "17:00",
      isAvailable: true,
      averageRating: "4.8",
      totalServicesCompleted: 150,
      firstTimeFixRate: "92.5",
    }).returning();

    // Create sample containers
    const containers_data = [];
    for (let i = 1; i <= 250; i++) {
      const isIot = i <= 90;
      const containerCode = `CNT${i.toString().padStart(6, '0')}`;
      const status = i <= 200 ? "active" : i <= 220 ? "maintenance" : "retired";
      
      containers_data.push({
        containerCode,
        type: i % 3 === 0 ? "refrigerated" : i % 3 === 1 ? "dry" : "special",
        manufacturer: i % 2 === 0 ? "CIMC" : "Hyundai",
        model: `Model-${i % 10 + 1}`,
        capacity: (20 + (i % 20)).toString(),
        purchaseDate: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
        status,
        orbcommDeviceId: isIot ? `ORB${i.toString().padStart(6, '0')}` : null,
        hasIot: isIot,
        currentLocation: {
          lat: 34.0522 + (Math.random() - 0.5) * 0.1,
          lng: -118.2437 + (Math.random() - 0.5) * 0.1,
        },
        currentCustomerId: i <= 100 ? customer1[0].id : customer2[0].id,
        assignmentDate: new Date(2024, 0, 1),
        expectedReturnDate: new Date(2024, 11, 31),
      });
    }

    const createdContainers = await db.insert(containers).values(containers_data).returning();

    // Create sample alerts
    const alerts_data = [];
    for (let i = 1; i <= 20; i++) {
      const container = createdContainers[Math.floor(Math.random() * createdContainers.length)];
      const severities = ["critical", "high", "medium", "low"];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      
      alerts_data.push({
        containerId: container.id,
        alertCode: `ALT-${Date.now()}-${i}`,
        alertType: "error",
        severity,
        description: `Alert ${i}: ${severity.toUpperCase()} issue detected`,
        source: "orbcomm",
        detectedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        metadata: {
          temperature: 25 + Math.random() * 10,
          humidity: 60 + Math.random() * 20,
          errorCode: `ERR${i.toString().padStart(3, '0')}`,
        },
      });
    }

    await db.insert(alerts).values(alerts_data);

    // Create sample service requests
    const serviceRequests_data = [];
    for (let i = 1; i <= 15; i++) {
      const container = createdContainers[Math.floor(Math.random() * createdContainers.length)];
      const priorities = ["urgent", "high", "normal", "low"];
      const statuses = ["pending", "approved", "scheduled", "in_progress", "completed"];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      serviceRequests_data.push({
        requestNumber: `SR-${Date.now()}-${i}`,
        containerId: container.id,
        customerId: container.currentCustomerId,
        issueDescription: `Service request ${i}: ${priority} priority issue`,
        priority,
        status,
        requestedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        assignedTechnicianId: technician1[0].id,
        requiredParts: [`PART${i.toString().padStart(3, '0')}`, `PART${(i+1).toString().padStart(3, '0')}`],
        usedParts: [],
        totalCost: (100 + Math.random() * 500).toString(),
        createdBy: adminUser[0].id,
      });
    }

    await db.insert(serviceRequests).values(serviceRequests_data);

    // Create sample inventory
    const inventory_data = [];
    for (let i = 1; i <= 50; i++) {
      inventory_data.push({
        partNumber: `PART${i.toString().padStart(3, '0')}`,
        partName: `Component ${i}`,
        category: i % 5 === 0 ? "electrical" : i % 5 === 1 ? "mechanical" : i % 5 === 2 ? "refrigeration" : i % 5 === 3 ? "safety" : "general",
        quantityInStock: Math.floor(Math.random() * 100) + 10,
        reorderLevel: 20,
        unitPrice: (10 + Math.random() * 200).toString(),
        location: `Warehouse-${(i % 3) + 1}`,
      });
    }

    await db.insert(inventory).values(inventory_data);

    console.log("✅ Database seeded successfully!");
    console.log(`📊 Created:`);
    console.log(`   - 3 users (admin, client, technician)`);
    console.log(`   - 2 customers`);
    console.log(`   - 1 technician`);
    console.log(`   - 250 containers (90 IoT-enabled)`);
    console.log(`   - 20 alerts`);
    console.log(`   - 15 service requests`);
    console.log(`   - 50 inventory items`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./shared/schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');

  try {
    // Create sample users
    const adminUser = await db.insert(schema.users).values({
      phoneNumber: "+1234567890",
      name: "Admin User",
      email: "admin@containergenie.com",
      role: "admin",
      isActive: true,
      whatsappVerified: true,
    }).returning();

    const clientUser = await db.insert(schema.users).values({
      phoneNumber: "+1987654321",
      name: "John Smith",
      email: "john@logistics.com",
      role: "client",
      isActive: true,
      whatsappVerified: true,
    }).returning();

    console.log("✅ Created users");

    // Create sample customers
    const customer1 = await db.insert(schema.customers).values({
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

    console.log("✅ Created customers");

    // Create sample containers (just a few for testing)
    const containers_data = [];
    for (let i = 1; i <= 10; i++) {
      containers_data.push({
        containerCode: `CNT${i.toString().padStart(6, '0')}`,
        type: (i % 3 === 0 ? "refrigerated" : i % 3 === 1 ? "dry" : "special"),
        manufacturer: i % 2 === 0 ? "CIMC" : "Hyundai",
        model: `Model-${i % 10 + 1}`,
        capacity: (20 + (i % 20)).toString(),
        status: i <= 8 ? "active" : i <= 9 ? "maintenance" : "retired",
        orbcommDeviceId: i <= 5 ? `ORB${i.toString().padStart(6, '0')}` : null,
        hasIot: i <= 5,
        currentLocation: {
          lat: 34.0522 + (Math.random() - 0.5) * 0.1,
          lng: -118.2437 + (Math.random() - 0.5) * 0.1,
          timestamp: new Date().toISOString(),
          source: "seed"
        },
        currentCustomerId: i <= 5 ? customer1[0].id : null,
        assignmentDate: new Date(2024, 0, 1),
        expectedReturnDate: new Date(2024, 11, 31),
        purchaseDate: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
        healthScore: 85 + (i % 15),
        usageCycles: i * 10 + (i % 50)
      });
    }

    const createdContainers = await db.insert(schema.containers).values(containers_data).returning();
    console.log("✅ Created containers");

    // Create sample alerts
    const alerts_data = [];
    for (let i = 1; i <= 5; i++) {
      const container = createdContainers[Math.floor(Math.random() * createdContainers.length)];
      const severities = ["critical", "high", "medium", "low"];
      const severity = severities[Math.floor(Math.random() * severities.length)];

      alerts_data.push({
        alertCode: `ALT-${Date.now()}-${i}`,
        containerId: container.id,
        alertType: "error",
        severity: severity,
        title: `Alert ${i}: ${severity.toUpperCase()} issue detected`,
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

    await db.insert(schema.alerts).values(alerts_data);
    console.log("✅ Created alerts");

    // Create sample service requests
    const serviceRequests_data = [];
    for (let i = 1; i <= 3; i++) {
      const container = createdContainers[Math.floor(Math.random() * createdContainers.length)];
      const priorities = ["urgent", "high", "normal", "low"];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];

      serviceRequests_data.push({
        requestNumber: `SR-${Date.now()}-${i}`,
        containerId: container.id,
        customerId: container.currentCustomerId,
        issueDescription: `Service request ${i}: ${priority} priority issue`,
        priority,
        status: "pending",
        requestedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        createdBy: adminUser[0].id,
      });
    }

    await db.insert(schema.serviceRequests).values(serviceRequests_data);
    console.log("✅ Created service requests");

    console.log("🎉 Database seeded successfully!");
    console.log(`📊 Created:`);
    console.log(`   - 2 users (admin, client)`);
    console.log(`   - 1 customer`);
    console.log(`   - 10 containers (5 IoT-enabled)`);
    console.log(`   - 5 alerts`);
    console.log(`   - 3 service requests`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

seedDatabase().then(() => {
  console.log("✅ Seeding completed!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});

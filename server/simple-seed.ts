import { db } from "./db";
import { users, customers, containers, alerts } from "../shared/schema";

export async function simpleSeed() {
  console.log("🌱 Simple seeding...");

  try {
    // Create a test user
    const testUser = await db.insert(users).values({
      phoneNumber: "917021307474",
      name: "Arzaan Ali Khan",
      email: "test@example.com",
      role: "admin",
      isActive: true,
      whatsappVerified: true,
    }).returning();

    console.log("✅ Created test user:", testUser[0].id);

    // Create a test customer
    const testCustomer = await db.insert(customers).values({
      userId: testUser[0].id,
      companyName: "Test Company",
      contactPerson: "Arzaan Ali Khan",
      email: "test@company.com",
      phone: "917021307474",
      whatsappNumber: "917021307474",
      customerTier: "standard",
      paymentTerms: "net30",
      billingAddress: "123 Test St",
      status: "active",
    }).returning();

    console.log("✅ Created test customer:", testCustomer[0].id);

    // Create a test container
    const testContainer = await db.insert(containers).values({
      containerCode: "TEST001",
      type: "dry",
      manufacturer: "Test Manufacturer",
      model: "Test Model",
      capacity: "20.00",
      purchaseDate: new Date(),
      status: "active",
      hasIot: true,
      currentLocation: { lat: 34.0522, lng: -118.2437 },
      currentCustomerId: testCustomer[0].id,
    }).returning();

    console.log("✅ Created test container:", testContainer[0].id);

    // Create a test alert
    const testAlert = await db.insert(alerts).values({
      containerId: testContainer[0].id,
      alertCode: "TEST-001",
      alertType: "error",
      severity: "high",
      description: "Test alert",
      source: "manual",
      detectedAt: new Date(),
      metadata: { test: true },
    }).returning();

    console.log("✅ Created test alert:", testAlert[0].id);

    console.log("✅ Simple seeding completed successfully!");

  } catch (error) {
    console.error("❌ Error in simple seeding:", error);
    throw error;
  }
}


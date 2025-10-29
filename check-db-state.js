import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./shared/schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

async function checkDatabaseState() {
  console.log('🔍 Checking database state...\n');

  try {
    // Check containers
    const containers = await db.select().from(schema.containers);
    console.log(`📦 Containers: ${containers.length}`);
    if (containers.length > 0) {
      console.log('   Sample container:', containers[0]);
    }

    // Check users
    const users = await db.select().from(schema.users);
    console.log(`👥 Users: ${users.length}`);
    if (users.length > 0) {
      console.log('   Sample user:', users[0]);
    }

    // Check customers
    const customers = await db.select().from(schema.customers);
    console.log(`🏢 Customers: ${customers.length}`);
    if (customers.length > 0) {
      console.log('   Sample customer:', customers[0]);
    }

    // Check alerts
    const alerts = await db.select().from(schema.alerts);
    console.log(`🚨 Alerts: ${alerts.length}`);
    if (alerts.length > 0) {
      console.log('   Sample alert:', alerts[0]);
    }

    // Check service requests
    const serviceRequests = await db.select().from(schema.serviceRequests);
    console.log(`🔧 Service Requests: ${serviceRequests.length}`);
    if (serviceRequests.length > 0) {
      console.log('   Sample service request:', serviceRequests[0]);
    }

    console.log('\n✅ Database check completed!');

  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  }
}

checkDatabaseState().then(() => {
  console.log('\n🎯 If no data is showing, run: npm run seed:rag');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Database check failed:', error);
  process.exit(1);
});


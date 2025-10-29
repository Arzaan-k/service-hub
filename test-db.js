import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users, customers, containers, alerts, serviceRequests } from './shared/schema.ts';

// Create a PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create drizzle instance
const db = drizzle(pool);

// Test the connection
async function testConnection() {
  try {
    // Test query to check connection
    const result = await db.execute('SELECT 1 as test');
    console.log('Database connection successful:', result);
    
    // Check users
    const usersResult = await db.select().from(users);
    console.log('Users count:', usersResult.length);
    
    if (usersResult.length > 0) {
      console.log('Sample users:');
      usersResult.slice(0, 5).forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.name} - Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
      });
    }
    
    // Test dashboard stats query
    const containersResult = await db.select().from(containers);
    console.log('Containers count:', containersResult.length);
    
    const alertsResult = await db.select().from(alerts);
    console.log('Alerts count:', alertsResult.length);
    
    const serviceRequestsResult = await db.select().from(serviceRequests);
    console.log('Service requests count:', serviceRequestsResult.length);
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
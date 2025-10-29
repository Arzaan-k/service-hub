// Check for admin users
import { db } from './server/db.js';
import { users, customers } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkAdminUsers() {
  console.log('🔍 Checking for admin users...');
  
  try {
    // Check for admin users
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    console.log(`Found ${adminUsers.length} admin users:`);
    adminUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email})`);
    });
    
    // Check for super_admin users
    const superAdminUsers = await db.select().from(users).where(eq(users.role, 'super_admin'));
    console.log(`\nFound ${superAdminUsers.length} super_admin users:`);
    superAdminUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email})`);
    });
    
    // Check for coordinator users
    const coordinatorUsers = await db.select().from(users).where(eq(users.role, 'coordinator'));
    console.log(`\nFound ${coordinatorUsers.length} coordinator users:`);
    coordinatorUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email})`);
    });
    
    // Check a specific admin user's customer relationship
    if (adminUsers.length > 0) {
      const adminUser = adminUsers[0];
      console.log(`\nChecking customer relationship for admin user: ${adminUser.name}`);
      
      const userCustomer = await db.select().from(customers).where(eq(customers.userId, adminUser.id));
      if (userCustomer.length > 0) {
        console.log(`Admin user is linked to customer: ${userCustomer[0].companyName}`);
      } else {
        console.log('Admin user is not linked to any customer');
      }
    }
    
    console.log('\n✅ Admin user check completed');
  } catch (error) {
    console.error('❌ Error checking admin users:', error);
  }
}

checkAdminUsers();
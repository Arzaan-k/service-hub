// Test to check authentication and data access
import { db } from './server/db.js';
import { users, customers, containers } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testAuthData() {
  console.log('🔍 Testing authentication and data access...');
  
  try {
    // Check if we have users
    const userList = await db.select().from(users).limit(5);
    console.log(`Found ${userList.length} users (showing first 5):`);
    userList.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - ${user.role}`);
    });
    
    // Check if we have customers
    const customerList = await db.select().from(customers).limit(5);
    console.log(`\nFound ${customerList.length} customers (showing first 5):`);
    customerList.forEach(customer => {
      console.log(`- ${customer.companyName} (${customer.email})`);
    });
    
    // Check a specific user's customer relationship
    if (userList.length > 0) {
      const firstUser = userList[0];
      console.log(`\nChecking customer relationship for user: ${firstUser.name}`);
      
      const userCustomer = await db.select().from(customers).where(eq(customers.userId, firstUser.id));
      if (userCustomer.length > 0) {
        console.log(`User is linked to customer: ${userCustomer[0].companyName}`);
        
        // Check containers for this customer
        const customerContainers = await db.select().from(containers).where(eq(containers.currentCustomerId, userCustomer[0].id));
        console.log(`Customer has ${customerContainers.length} containers`);
      } else {
        console.log('User is not linked to any customer');
      }
    }
    
    console.log('\n✅ Authentication and data access test completed');
  } catch (error) {
    console.error('❌ Error testing authentication and data access:', error);
  }
}

testAuthData();
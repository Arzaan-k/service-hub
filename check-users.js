import { db } from './server/db.js';
import { users } from './shared/schema.js';

async function checkUsers() {
  console.log('🔍 Checking users in database...');
  
  try {
    const allUsers = await db.select().from(users);
    
    console.log(`Found ${allUsers.length} users:`);
    
    for (const user of allUsers) {
      console.log(`- ${user.name} (${user.email}) - ${user.role}`);
    }
    
    if (allUsers.length > 0) {
      console.log(`\nUsing first user ID for testing: ${allUsers[0].id}`);
      
      // Try inserting with a valid user ID
      const [created] = await db.insert(manuals).values({
        name: 'Test Manual with Valid User',
        version: 'v1.0',
        meta: {
          brand: 'Test',
          model: 'Test Model'
        },
        uploadedBy: allUsers[0].id,
        uploadedOn: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log('✅ Successfully inserted manual with valid user ID:', created.name);
    }
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
}

// Import manuals separately since it's not exported from db.js
import { manuals } from './shared/schema.js';

checkUsers();
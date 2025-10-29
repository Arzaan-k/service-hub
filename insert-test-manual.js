import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function insertTestManual() {
  console.log('🔍 Testing manual insertion...');
  
  try {
    // Try direct SQL insertion
    const result = await db.execute(
      sql`INSERT INTO manuals (name, version, meta, uploaded_by, uploaded_on, created_at, updated_at) 
          VALUES ('Test Manual', 'v1.0', '{"brand": "Test", "model": "Test Model"}', 'system', NOW(), NOW(), NOW())
          RETURNING id, name;`
    );
    
    console.log('Direct SQL insertion result:', result.rows);
    
    // Try ORM insertion
    const [created] = await db.insert(manuals).values({
      name: 'Test Manual ORM',
      version: 'v1.0',
      meta: {
        brand: 'Test',
        model: 'Test Model ORM'
      },
      uploadedBy: 'system',
      uploadedOn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log('ORM insertion result:', created);
    
    // Check all manuals
    const allManuals = await db.select().from(manuals);
    console.log(`Total manuals: ${allManuals.length}`);
    allManuals.forEach(manual => {
      console.log(`- ${manual.name} (v${manual.version})`);
    });
  } catch (error) {
    console.error('❌ Error inserting test manual:', error);
  }
}

insertTestManual();
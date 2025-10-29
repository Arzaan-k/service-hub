import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkManuals() {
  console.log('🔍 Checking RAG manuals in database...');
  
  try {
    const allManuals = await db.select().from(manuals);
    
    console.log(`Found ${allManuals.length} manuals:`);
    
    for (const manual of allManuals) {
      console.log(`- ${manual.name} (v${manual.version})`);
      if (manual.meta) {
        console.log(`  Brand: ${manual.meta.brand}`);
        console.log(`  Model: ${manual.meta.model}`);
        console.log(`  Alarms: ${manual.meta.alarms?.join(', ')}`);
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error checking manuals:', error);
  }
}

checkManuals();
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';

async function checkAllManuals() {
  console.log('🔍 Checking all RAG manuals in database...');
  
  try {
    const allManuals = await db.select().from(manuals);
    
    console.log(`Found ${allManuals.length} manuals:`);
    
    for (const manual of allManuals) {
      console.log(`- ${manual.name} (v${manual.version || 'N/A'})`);
      if (manual.meta) {
        console.log(`  Brand: ${manual.meta.brand || 'N/A'}`);
        console.log(`  Model: ${manual.meta.model || 'N/A'}`);
        if (manual.meta.alarms) {
          console.log(`  Alarms: ${manual.meta.alarms.join(', ')}`);
        }
        if (manual.meta.components) {
          console.log(`  Components: ${manual.meta.components.join(', ')}`);
        }
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error checking manuals:', error);
  }
}

checkAllManuals();
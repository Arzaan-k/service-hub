import 'dotenv/config';
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';

async function checkManualIds() {
  try {
    const allManuals = await db.select({ id: manuals.id, name: manuals.name, sourceUrl: manuals.sourceUrl }).from(manuals);
    console.log('Manuals in database:');
    allManuals.forEach(manual => {
      console.log(`ID: ${manual.id}`);
      console.log(`Name: ${manual.name}`);
      console.log(`SourceUrl: ${manual.sourceUrl}`);
      console.log('---');
    });

    // Check if the problematic ID exists
    const testId = 'test-reprocess-1762248413204';
    const exists = allManuals.some(m => m.id === testId);
    console.log(`\nDoes manual ID '${testId}' exist? ${exists}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkManualIds();

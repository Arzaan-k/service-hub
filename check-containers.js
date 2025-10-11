import { db } from './server/db.js';
import { containers } from './shared/schema.js';

async function checkContainers() {
  console.log('Checking current containers in database...');

  try {
    const allContainers = await db.select().from(containers);
    console.log(`Total containers: ${allContainers.length}`);

    // Check for containers with "for sale" status
    const forSaleContainers = allContainers.filter(c => c.status === 'for sale' || c.status === 'for_sale');
    console.log(`Containers with "for sale" status: ${forSaleContainers.length}`);

    if (forSaleContainers.length > 0) {
      console.log('Sample "for sale" containers:');
      forSaleContainers.slice(0, 3).forEach(c => {
        console.log(`- ${c.containerCode}: ${c.status}`);
      });
    }

    // Show all unique statuses
    const statuses = [...new Set(allContainers.map(c => c.status))];
    console.log('All unique container statuses:', statuses);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkContainers();


import { db } from './db.ts';
import { containers } from '../shared/schema.js';

async function checkContainers() {
  console.log('Checking current containers in database...');

  try {
    const allContainers = await db.select().from(containers);
    console.log(`Total containers: ${allContainers.length}`);

    // Check for containers with "for sale" status (check multiple possible formats)
    const forSaleContainers = allContainers.filter(c =>
      c.status === 'for sale' ||
      c.status === 'for_sale' ||
      c.status === 'available' ||
      c.status === 'new'
    );
    console.log(`Containers with potential "for sale" status: ${forSaleContainers.length}`);

    if (forSaleContainers.length > 0) {
      console.log('Sample containers that might be "for sale":');
      forSaleContainers.slice(0, 3).forEach(c => {
        console.log(`- ${c.containerCode}: ${c.status}`);
      });
    }

    // Show all unique statuses
    const statuses = [...new Set(allContainers.map(c => c.status))];
    console.log('All unique container statuses:', statuses);

    // Show first few containers
    if (allContainers.length > 0) {
      console.log('\nFirst 3 containers:');
      allContainers.slice(0, 3).forEach(c => {
        console.log(`- ${c.containerCode}: ${c.status} (${c.type})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkContainers();

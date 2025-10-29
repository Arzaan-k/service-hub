import { db } from './server/db.js';
import { containers, alerts } from './shared/schema.js';

async function checkBasicData() {
  console.log('🔍 Checking basic data connectivity...');
  
  try {
    // Check containers
    const containerCount = await db.select().from(containers);
    console.log(`Found ${containerCount.length} containers`);
    
    if (containerCount.length > 0) {
      console.log('Sample containers:');
      containerCount.slice(0, 3).forEach(container => {
        console.log(`- ${container.containerCode} (${container.status})`);
      });
    }
    
    // Check alerts
    const alertCount = await db.select().from(alerts);
    console.log(`Found ${alertCount.length} alerts`);
    
    if (alertCount.length > 0) {
      console.log('Sample alerts:');
      alertCount.slice(0, 3).forEach(alert => {
        console.log(`- ${alert.title} (${alert.severity})`);
      });
    }
    
    console.log('✅ Basic data connectivity is working');
  } catch (error) {
    console.error('❌ Error checking basic data:', error);
  }
}

checkBasicData();
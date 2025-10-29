// Test storage functions directly
import { storage } from './server/storage.js';

async function testStorage() {
  console.log('🔍 Testing storage functions...');
  
  try {
    // Test getAllContainers directly
    console.log('Testing getAllContainers...');
    const allContainers = await storage.getAllContainers();
    console.log(`Found ${allContainers.length} containers`);
    
    if (allContainers.length > 0) {
      console.log('Sample containers:');
      allContainers.slice(0, 3).forEach(container => {
        console.log(`- ${container.containerCode} (${container.status})`);
        if (container.currentLocation) {
          console.log(`  Location: ${container.currentLocation.lat}, ${container.currentLocation.lng}`);
        } else {
          console.log(`  Location: None`);
        }
      });
    }
    
    // Test getAllAlerts directly
    console.log('\nTesting getAllAlerts...');
    const allAlerts = await storage.getAllAlerts();
    console.log(`Found ${allAlerts.length} alerts`);
    
    if (allAlerts.length > 0) {
      console.log('Sample alerts:');
      allAlerts.slice(0, 3).forEach(alert => {
        console.log(`- ${alert.title} (${alert.severity})`);
      });
    }
    
    console.log('\n✅ Storage test completed');
  } catch (error) {
    console.error('❌ Error testing storage:', error);
  }
}

testStorage();
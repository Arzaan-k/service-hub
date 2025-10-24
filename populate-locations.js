// Simple script to populate containers with location data
import { storage } from './server/storage.js';

async function populateContainers() {
  try {
    console.log('🔄 Populating containers with location data...');

    // Get all containers
    const containers = await storage.getAllContainers();
    console.log(`📦 Found ${containers.length} containers`);

    // Update containers without currentLocation
    let updated = 0;
    const defaultLocations = [
      { lat: 33.7434, lng: -118.2726, name: "LA Port" },
      { lat: 32.7157, lng: -117.1611, name: "San Diego" },
      { lat: 37.8044, lng: -122.2712, name: "Oakland" },
      { lat: 33.7701, lng: -118.1937, name: "Long Beach" },
      { lat: 37.7749, lng: -122.4194, name: "San Francisco" }
    ];

    for (let i = 0; i < containers.length; i++) {
      const container = containers[i];
      if (!container.currentLocation) {
        const location = defaultLocations[i % defaultLocations.length];
        await storage.updateContainer(container.id, {
          currentLocation: {
            lat: location.lat,
            lng: location.lng,
            address: location.name,
            source: 'default'
          },
          updatedAt: new Date()
        });
        console.log(`📍 Updated container ${container.containerCode} with location: ${location.name}`);
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} containers with default locations`);
    console.log('🎉 Containers should now show on the map!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

populateContainers();

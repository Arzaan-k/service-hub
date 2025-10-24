import 'dotenv/config';
import { storage } from './server/storage.js';

async function populateContainerLocations() {
  try {
    console.log('🔄 Adding default locations to containers without currentLocation...');

    const containers = await storage.getAllContainers();
    console.log(`📦 Found ${containers.length} containers`);

    // Default locations for containers without currentLocation
    const defaultLocations = [
      { lat: 33.7434, lng: -118.2726, name: "LA Port" },
      { lat: 32.7157, lng: -117.1611, name: "San Diego" },
      { lat: 37.8044, lng: -122.2712, name: "Oakland" },
      { lat: 33.7701, lng: -118.1937, name: "Long Beach" },
      { lat: 37.7749, lng: -122.4194, name: "San Francisco" },
      { lat: 34.0522, lng: -118.2437, name: "Los Angeles" },
      { lat: 40.7128, lng: -74.0060, name: "New York" },
      { lat: 25.7617, lng: -80.1918, name: "Miami" }
    ];

    let updated = 0;
    for (let i = 0; i < containers.length; i++) {
      const container = containers[i];

      // Check if container needs location data
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
    console.log('🎉 Dashboard should now show containers on the map!');

  } catch (error) {
    console.error('❌ Error populating container locations:', error);
  }
}

populateContainerLocations();

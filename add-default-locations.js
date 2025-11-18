import { storage } from './server/storage.js';

// Add default locations to containers that don't have them
async function addDefaultLocations() {
  try {
    console.log('🔄 Adding default locations to containers...');
    const containers = await storage.getAllContainers();

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
    for (const container of containers) {
      if (!container.currentLocation) {
        const location = defaultLocations[updated % defaultLocations.length];
        await storage.updateContainer(container.id, {
          currentLocation: {
            lat: location.lat,
            lng: location.lng,
            address: location.name,
            source: 'default'
          },
          updatedAt: new Date()
        });
        console.log(`📍 Added default location to container ${container.containerCode}: ${location.name}`);
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} containers with default locations`);
  } catch (error) {
    console.error('❌ Error adding default locations:', error);
  }
}

addDefaultLocations();

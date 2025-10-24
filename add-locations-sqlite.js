// Direct database script to add currentLocation to containers
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For SQLite (adjust path as needed)
const dbPath = path.join(__dirname, 'service-hub.db');
const db = new Database(dbPath);

try {
  console.log('🔄 Adding currentLocation to containers...');

  // Check current containers
  const containers = db.prepare('SELECT id, container_code FROM containers LIMIT 10').all();
  console.log(`📦 Found ${containers.length} containers`);

  if (containers.length === 0) {
    console.log('⚠️ No containers found in database');
    return;
  }

  // Add currentLocation to containers that don't have it
  const defaultLocations = [
    { lat: 33.7434, lng: -118.2726, name: "LA Port" },
    { lat: 32.7157, lng: -117.1611, name: "San Diego" },
    { lat: 37.8044, lng: -122.2712, name: "Oakland" },
    { lat: 33.7701, lng: -118.1937, name: "Long Beach" },
    { lat: 37.7749, lng: -122.4194, name: "San Francisco" }
  ];

  let updated = 0;
  for (let i = 0; i < containers.length; i++) {
    const container = containers[i];

    // Check if currentLocation exists
    const hasLocation = db.prepare('SELECT current_location FROM containers WHERE id = ?').get(container.id);

    if (!hasLocation.current_location) {
      const location = defaultLocations[i % defaultLocations.length];
      const currentLocation = JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        address: location.name,
        source: 'default'
      });

      db.prepare('UPDATE containers SET current_location = ?, updated_at = ? WHERE id = ?')
        .run(currentLocation, new Date().toISOString(), container.id);

      console.log(`📍 Updated container ${container.container_code} with location: ${location.name}`);
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} containers with currentLocation data`);
  console.log('🎉 Containers should now show on the map!');

} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}

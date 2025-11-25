import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkContainers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT id, container_id, current_location, location_lat, location_lng, orbcomm_device_id, has_iot FROM containers LIMIT 20');

    console.log('Sample containers with GPS data:');
    let withGps = 0;
    let withIot = 0;

    result.rows.forEach(row => {
      const hasCurrentLocation = row.current_location && row.current_location.lat && row.current_location.lng;
      const hasLatLng = row.location_lat && row.location_lng &&
                       parseFloat(row.location_lat) !== 0 && parseFloat(row.location_lng) !== 0;
      const hasGps = hasCurrentLocation || hasLatLng;
      const hasIotDevice = !!row.orbcomm_device_id || row.has_iot;

      if (hasGps) withGps++;
      if (hasIotDevice) withIot++;

      console.log(`${row.container_id}: GPS=${hasGps ? 'YES' : 'NO'}, IoT=${hasIotDevice ? 'YES' : 'NO'}`);
      if (hasGps) {
        console.log(`  → ${hasCurrentLocation ? 'current_location' : 'location_lat/lng'}: [${hasCurrentLocation ? row.current_location.lat : row.location_lat}, ${hasCurrentLocation ? row.current_location.lng : row.location_lng}]`);
      }
    });

    console.log(`\nSummary: ${withGps} containers with GPS, ${withIot} with IoT devices`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkContainers();

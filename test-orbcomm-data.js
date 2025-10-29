import { getOrbcommClient } from './server/services/orbcomm-real.ts';

async function testOrbcommData() {
  try {
    console.log('Testing ORBCOMM data retrieval...');
    
    const client = getOrbcommClient();
    console.log('ORBCOMM client connected:', client.isConnected);
    
    if (client.isConnected) {
      console.log('Fetching devices...');
      const devices = await client.getAllDevices();
      console.log('Devices retrieved:', devices.length);
      console.log('Devices:', JSON.stringify(devices, null, 2));
      
      if (devices.length > 0) {
        const deviceId = devices[0].deviceId;
        console.log(`Fetching data for device: ${deviceId}`);
        const deviceData = await client.getDeviceData(deviceId);
        console.log('Device data:', JSON.stringify(deviceData, null, 2));
      }
    } else {
      console.log('ORBCOMM client is not connected');
    }
  } catch (error) {
    console.error('Error testing ORBCOMM data:', error);
  }
}

testOrbcommData();
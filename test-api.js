import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:5000';

async function testAPI() {
  console.log('🧪 Testing API endpoints...\n');

  try {
    // Test dashboard stats
    console.log('Testing /api/dashboard/stats...');
    const statsResponse = await fetch(`${BASE_URL}/api/dashboard/stats`, {
      headers: {
        'x-user-id': 'test-admin-123',
        'Content-Type': 'application/json'
      }
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Dashboard stats:', stats);
    } else {
      console.log('❌ Dashboard stats failed:', statsResponse.status, statsResponse.statusText);
    }

    // Test containers
    console.log('\nTesting /api/containers...');
    const containersResponse = await fetch(`${BASE_URL}/api/containers`, {
      headers: {
        'x-user-id': 'test-admin-123',
        'Content-Type': 'application/json'
      }
    });

    if (containersResponse.ok) {
      const containers = await containersResponse.json();
      console.log('✅ Containers:', containers.length, 'found');
      if (containers.length > 0) {
        console.log('   Sample container:', containers[0]);
      }
    } else {
      console.log('❌ Containers failed:', containersResponse.status, containersResponse.statusText);
    }

    // Test alerts
    console.log('\nTesting /api/alerts...');
    const alertsResponse = await fetch(`${BASE_URL}/api/alerts`, {
      headers: {
        'x-user-id': 'test-admin-123',
        'Content-Type': 'application/json'
      }
    });

    if (alertsResponse.ok) {
      const alerts = await alertsResponse.json();
      console.log('✅ Alerts:', alerts.length, 'found');
      if (alerts.length > 0) {
        console.log('   Sample alert:', alerts[0]);
      }
    } else {
      console.log('❌ Alerts failed:', alertsResponse.status, alertsResponse.statusText);
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n💡 Make sure the server is running: npm run dev');
  }
}

testAPI();


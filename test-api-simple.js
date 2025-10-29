// Simple test to verify API endpoints are working
import axios from 'axios';

async function testApiEndpoints() {
  console.log('🔍 Testing API endpoints...');
  
  try {
    // Test containers endpoint (public endpoint)
    console.log('Testing /api/containers endpoint...');
    const containersResponse = await axios.get('http://localhost:3000/api/containers');
    console.log(`✅ Containers endpoint working - Found ${containersResponse.data.length} containers`);
    
    // Test alerts endpoint (public endpoint)
    console.log('Testing /api/alerts endpoint...');
    const alertsResponse = await axios.get('http://localhost:3000/api/alerts');
    console.log(`✅ Alerts endpoint working - Found ${alertsResponse.data.length} alerts`);
    
    console.log('✅ All basic API endpoints are working');
  } catch (error) {
    console.error('❌ Error testing API endpoints:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testApiEndpoints();
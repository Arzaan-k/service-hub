// More comprehensive test to verify API endpoints are working correctly
import axios from 'axios';

async function testApiEndpoints() {
  console.log('🔍 Testing API endpoints comprehensively...');
  
  try {
    // Test containers endpoint with different filters
    console.log('\n--- Testing /api/containers endpoint ---');
    const containersResponse = await axios.get('http://localhost:3000/api/containers');
    console.log(`Total containers: ${containersResponse.data.length}`);
    
    // Test containers by status
    console.log('\n--- Testing /api/containers/status endpoints ---');
    const statuses = ['active', 'sold', 'maintenance'];
    
    for (const status of statuses) {
      try {
        const statusResponse = await axios.get(`http://localhost:3000/api/containers/status/${status}`);
        console.log(`${status} containers: ${statusResponse.data.length}`);
      } catch (error) {
        console.log(`Error fetching ${status} containers: ${error.response?.status || error.message}`);
      }
    }
    
    // Test alerts endpoint
    console.log('\n--- Testing /api/alerts endpoint ---');
    const alertsResponse = await axios.get('http://localhost:3000/api/alerts');
    console.log(`Total alerts: ${alertsResponse.data.length}`);
    
    // Test alerts by severity
    console.log('\n--- Testing /api/alerts/severity endpoints ---');
    const severities = ['critical', 'high', 'medium', 'low'];
    
    for (const severity of severities) {
      try {
        const severityResponse = await axios.get(`http://localhost:3000/api/alerts/severity/${severity}`);
        console.log(`${severity} alerts: ${severityResponse.data.length}`);
      } catch (error) {
        console.log(`Error fetching ${severity} alerts: ${error.response?.status || error.message}`);
      }
    }
    
    console.log('\n✅ API endpoint testing completed');
  } catch (error) {
    console.error('❌ Error testing API endpoints:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testApiEndpoints();
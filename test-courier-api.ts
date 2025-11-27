import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TRACKINGMORE_API_KEY = process.env.TRACKINGMORE_API_KEY;
const TRACKINGMORE_API_URL = 'https://api.trackingmore.com/v3';

async function testTrackingMoreAPI() {
  console.log('🧪 Testing TrackingMore API...\n');

  if (!TRACKINGMORE_API_KEY) {
    console.error('❌ TRACKINGMORE_API_KEY not found in .env');
    return;
  }

  console.log('✅ API Key found:', TRACKINGMORE_API_KEY.substring(0, 8) + '...');

  try {
    // Test 1: Auto-detect courier from AWB number
    console.log('\n📦 Test 1: Detecting courier from AWB number...');
    const testAwb = 'DEL123456789'; // Example AWB

    const detectResponse = await axios.post(
      `${TRACKINGMORE_API_URL}/trackings/detect`,
      { tracking_number: testAwb },
      {
        headers: {
          'Tracking-Api-Key': TRACKINGMORE_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Detect API Response Status:', detectResponse.status);
    console.log('📋 Response Data:', JSON.stringify(detectResponse.data, null, 2));

    // Test 2: Create tracking
    console.log('\n📦 Test 2: Creating tracking...');
    const createResponse = await axios.post(
      `${TRACKINGMORE_API_URL}/trackings/create`,
      {
        tracking_number: testAwb,
        courier_code: 'delhivery'
      },
      {
        headers: {
          'Tracking-Api-Key': TRACKINGMORE_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Create API Response Status:', createResponse.status);
    console.log('📋 Response Data:', JSON.stringify(createResponse.data, null, 2));

    // Test 3: Get tracking details
    console.log('\n📦 Test 3: Getting tracking details...');
    const getResponse = await axios.get(
      `${TRACKINGMORE_API_URL}/trackings/get?tracking_numbers=${testAwb}&courier_code=delhivery`,
      {
        headers: {
          'Tracking-Api-Key': TRACKINGMORE_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Get API Response Status:', getResponse.status);
    console.log('📋 Response Data:', JSON.stringify(getResponse.data, null, 2));

    console.log('\n✅ All API tests completed successfully!');
    console.log('\n🎉 Your TrackingMore API is working correctly!');
    console.log('\n💡 You can now:');
    console.log('   1. Navigate to any Service Request detail page');
    console.log('   2. Click "Courier Tracking" tab');
    console.log('   3. Add a real AWB number to track shipments');

  } catch (error: any) {
    console.error('\n❌ API Test Failed!');

    if (error.response) {
      console.error('\n📋 Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });

      if (error.response.status === 401) {
        console.error('\n❌ Authentication Failed: Invalid API Key');
        console.error('💡 Please check your TRACKINGMORE_API_KEY in .env file');
      } else if (error.response.status === 429) {
        console.error('\n⚠️ Rate Limit Exceeded: Too many requests');
        console.error('💡 Please wait a few minutes and try again');
      } else if (error.response.status === 400) {
        console.error('\n⚠️ Bad Request: Check the AWB number format');
      }
    } else if (error.request) {
      console.error('\n❌ Network Error: No response received');
      console.error('💡 Check your internet connection');
    } else {
      console.error('\n❌ Error:', error.message);
    }
  }

  process.exit(0);
}

testTrackingMoreAPI();

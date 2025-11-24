import fetch from 'node-fetch';

async function testContainersAPI() {
  try {
    console.log('Testing containers API...');
    const response = await fetch('http://localhost:5000/api/containers?limit=5&offset=0', {
      headers: {
        'x-user-id': '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Response data:', data);
    console.log('Data length:', Array.isArray(data) ? data.length : 'Not an array');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testContainersAPI();





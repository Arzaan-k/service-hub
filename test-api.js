async function testAPI() {
  try {
    console.log('Testing containers API...');

    const response = await fetch('http://localhost:5000/api/containers', {
      headers: {
        'x-user-id': '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'
      }
    });

    console.log('Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Success! Got', data.length, 'containers');
      if (data.length > 0) {
        console.log('First container:', data[0]);
      }
    } else {
      const error = await response.text();
      console.log('Error:', error);
    }

  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testAPI();

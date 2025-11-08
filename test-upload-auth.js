import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function testAuthAndUpload() {
  try {
    console.log('🧪 Testing authentication and upload...\n');

    // First test: Check if server is running
    console.log('1. Checking server status...');
    try {
      const healthResponse = await axios.get('http://localhost:5000');
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server is not running on localhost:5000');
      console.log('Start the server with: npm run dev');
      return;
    }

    // Second test: Test authentication
    console.log('\n2. Testing authentication...');
    try {
      const authResponse = await axios.get('http://localhost:5000/api/manuals', {
        headers: {
          'x-user-id': '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'
        }
      });
      console.log('✅ Authentication successful');
    } catch (error) {
      console.log('❌ Authentication failed:', error.response?.status, error.response?.data?.error);
      return;
    }

    // Third test: Test file upload with small file
    console.log('\n3. Testing file upload...');

    const testFile = 'test-upload.txt';
    if (!fs.existsSync(testFile)) {
      console.log('❌ Test file not found:', testFile);
      return;
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFile), {
      filename: 'test-manual.txt',
      contentType: 'text/plain'
    });
    formData.append('name', 'Test Manual');
    formData.append('version', '1.0');

    const uploadResponse = await axios.post('http://localhost:5000/api/manuals/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'x-user-id': '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'
      },
      timeout: 30000
    });

    console.log('✅ Upload successful!');
    console.log('Manual ID:', uploadResponse.data.id);
    console.log('File path:', uploadResponse.data.fileInfo?.savedPath);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAuthAndUpload();


<<<<<<< Updated upstream






=======
>>>>>>> Stashed changes

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

// Simple test to debug the upload issue
async function debugUpload() {
  try {
    console.log('Testing file upload...\n');

    // Use the small test file
    const testFilePath = 'test-upload.txt';
    const testFileName = 'debug-test-manual.txt';

    if (!fs.existsSync(testFilePath)) {
      console.error('❌ Test file not found:', testFilePath);
      return;
    }

    console.log('📁 Test file:', testFilePath);
    console.log('📄 File size:', fs.statSync(testFilePath).size, 'bytes');

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath), {
      filename: testFileName,
      contentType: 'text/plain'
    });
    formData.append('name', 'Debug Test Manual');
    formData.append('version', '1.0');

    console.log('\n📤 Sending upload request...');
    console.log('URL: http://localhost:5000/api/manuals/upload');
    console.log('Method: POST');
    console.log('Content-Type:', formData.getHeaders()['content-type']);

    // Check if server is running first
    try {
      await axios.get('http://localhost:5000');
      console.log('✅ Server is running');
    } catch (error) {
      console.error('❌ Server is not running on localhost:5000');
      console.log('Please start the server with: npm run dev');
      return;
    }

    const response = await axios.post('http://localhost:5000/api/manuals/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        // Try without auth first to see what error we get
      },
      timeout: 30000
    });

    console.log('\n✅ Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ Upload failed:');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received. Request details:');
      console.error('  - Timeout or connection issue');
      console.error('  - Server might not be running');
    } else {
      console.error('Request setup error:', error.message);
    }
  }
}

debugUpload();



<<<<<<< Updated upstream





=======
>>>>>>> Stashed changes

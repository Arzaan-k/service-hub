const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testFileUpload() {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream('test-upload.txt'), {
      filename: 'test-manual.txt',
      contentType: 'text/plain'
    });
    formData.append('name', 'Test Manual');
    formData.append('version', '1.0');

    // Make the request (assuming server runs on localhost:3000)
    const response = await axios.post('http://localhost:3000/api/manuals/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        // Add authentication header if needed
        'Authorization': 'Bearer your-auth-token-here'
      }
    });

    console.log('Upload successful:', response.data);

    // Check if file exists
    if (response.data.fileInfo && response.data.fileInfo.savedPath) {
      const fileExists = fs.existsSync(response.data.fileInfo.savedPath);
      console.log('File saved to disk:', fileExists);
      if (fileExists) {
        console.log('File path:', response.data.fileInfo.savedPath);
      }
    }

  } catch (error) {
    console.error('Upload failed:', error.response ? error.response.data : error.message);
  }
}

testFileUpload();








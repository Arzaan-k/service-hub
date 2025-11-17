// Quick test to check if API returns client uploaded media
const testServiceRequestId = 'f3e2b2b6-d949-40e5-bd33-810e9dd4ca3f'; // SR-1763010943709135

fetch(`http://localhost:5000/api/service-requests/${testServiceRequestId}`, {
  headers: {
    'Cookie': 'session_token=your_session_token_here' // You'll need to get this from browser
  }
})
.then(r => r.json())
.then(data => {
  console.log('API Response:');
  console.log('clientUploadedPhotos:', data.clientUploadedPhotos);
  console.log('clientUploadedVideos:', data.clientUploadedVideos);
  console.log('beforePhotos:', data.beforePhotos);
  console.log('afterPhotos:', data.afterPhotos);
})
.catch(err => console.error('Error:', err));

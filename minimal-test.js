import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Hello World', timestamp: new Date().toISOString() }));
});

server.listen(5001, '0.0.0.0', () => {
  console.log('Minimal test server running on port 5001');
  console.log('Try accessing: http://localhost:5001');
});

// Also listen on IPv6
server.listen(5001, '::', () => {
  console.log('Server also listening on IPv6 port 5001');
});
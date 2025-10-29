import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

server.listen(5001, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:5001/');
});
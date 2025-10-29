import express from 'express';

const app = express();
const port = 3001;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/containers', (req, res) => {
  res.json([{ id: 1, name: 'Test Container' }]);
});

app.listen(port, 'localhost', () => {
  console.log(`Test server listening at http://localhost:${port}`);
});
import express from 'express';
import cors from 'cors';

const app = express();

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

const port = 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Test server listening on port ${port}`);
});





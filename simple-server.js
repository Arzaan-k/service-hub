import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';
const { containers, alerts, customers } = schema;

const app = express();
const port = 5000;

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));

app.use(express.json());

// Simple auth middleware for testing
app.use((req, res, next) => {
  // Accept test-admin-123 as valid token for testing
  const userId = req.headers['x-user-id'];
  if (userId === 'test-admin-123') {
    req.user = {
      id: 'test-admin-123',
      name: 'Test Admin',
      role: 'admin',
      isActive: true
    };
  }
  next();
});

// API Routes
app.get('/api/containers', async (req, res) => {
  try {
    console.log('Fetching containers from database...');
    const containerList = await db.select().from(containers).limit(10);
    console.log(`Found ${containerList.length} containers`);
    res.json(containerList);
  } catch (error) {
    console.error('Error fetching containers:', error);
    res.status(500).json({ error: 'Failed to fetch containers' });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    console.log('Fetching alerts from database...');
    // Import alerts schema
    const { alerts } = await import('./shared/schema.ts');
    const alertList = await db.select().from(alerts).limit(10);
    console.log(`Found ${alertList.length} alerts`);
    res.json(alertList);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.get('/api/clients', async (req, res) => {
  try {
    console.log('Fetching clients from database...');
    // Import customers schema
    const { customers } = await import('./shared/schema.ts');
    const clientList = await db.select().from(customers).limit(10);
    console.log(`Found ${clientList.length} clients`);
    res.json(clientList);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.listen(port, 'localhost', () => {
  console.log(`Simple test server running at http://localhost:${port}`);
});
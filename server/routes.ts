import { Express } from 'express';
import { ragAdapter } from './services/ragAdapter';

export const registerRoutes = (app: Express) => {
  app.post('/api/rag/query', async (req, res) => {
    try {
      const result = await ragAdapter.query(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error in RAG query:', error);
      res.status(500).json({ message: 'Error processing RAG query' });
    }
  });

  app.get('/api/rag/history', async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
      const history = await ragAdapter.getUserQueryHistory(userId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching RAG history:', error);
      res.status(500).json({ message: 'Error fetching RAG history' });
    }
  });

  return app;
};
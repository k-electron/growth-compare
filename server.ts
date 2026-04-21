import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import url from 'url';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/stock-data', async (req, res) => {
    try {
      const { tickers, start, end } = req.body;
      if (!Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: 'Tickers array is required' });
      }

      const period1 = start;
      const period2 = end;

      const results: Record<string, any> = {};
      
      const promises = tickers.map(async (ticker) => {
        try {
          const data = await yahooFinance.historical(ticker, {
            period1: start,
            period2: end,
            interval: '1d',
          });
          results[ticker] = data;
        } catch (error: any) {
          console.error(`Failed to fetch data for ${ticker}:`, error.message);
          results[ticker] = { error: error.message || 'Unknown error fetching data' };
        }
      });

      await Promise.all(promises);
      res.json(results);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

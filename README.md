# Growth Compare

A financial visualization tool to compare stock performance over time. Growth Compare calculates stock growth as a percentage offset from an initial date, providing clear baseline comparisons for arbitrary time windows to surface actual long-term relative outperformance.

## Hosted Version

A hosted version of the site is available at: [https://growthcompare.pages.dev](https://growthcompare.pages.dev)

## Features
- **Arbitrary Time Windows**: Customize your start and end dates automatically, with baseline 0% shifts depending on dynamic availability overlap.
- **Multiple Timeframe Presets**: Click-to-adjust 1M, 3M, 6M, YTD, 1Y, 5Y, and 10Y timeframes.
- **Corporate Action Verification**: Accounts for events via the backing historical charting APIs.
- **Auto Ticker Adjustments**: Safely limits to a cyclic queue of up to 5 valid tickers, dropping inactive inputs while actively resolving symbol rotations (e.g. FB -> META) seamlessly prior to chart hydration.
- **URL Syncing**: Hot-links date fields and selected tickers right into the native URL query string, supporting immediate pre-loading and shareable chart snapshots.

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (runs both frontend and the Express backend):
   ```bash
   npm run dev
   ```
   *Note: Using standard `vite` natively will result in a 405 Method Not Allowed error because the application requires the specific Express backend runtime on `/api/stock-data` to scrape Yahoo Finance natively.*

3. Build and Preview for production:
   ```bash
   npm run build
   npm run preview
   ```

### Production Deployment (Node.js)
This project requires a standard Node.js runtime environment (like Google Cloud Run, Heroku, or Render) due to the heavy backend data-fetching operations inside `server.ts` which proxy Yahoo Finance API calls. 

Since it uses native server-side libraries, deploying to pure edge computing environments (like Cloudflare Pages or Vercel Edge) directly is not advised out-of-the-box because they do not fully polyfilled APIs (like `__dirname` and deep filesystem calls required by dependencies). Ensure your hosting environment boots via `npm run start` and serves `dist/server.js`!

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

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   npm run start
   ```
